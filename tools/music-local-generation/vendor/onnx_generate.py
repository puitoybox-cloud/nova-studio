# Adapted from SkyTNT/midi-model f504d5cb58f769ab0f2909c679238f6621034573
# Apache-2.0; see SkyTNT-LICENSE. CPU only, progress removed.
import numpy as np
import onnxruntime as rt
import contextlib
device="cpu"
def softmax(x, axis):
    x_max = np.amax(x, axis=axis, keepdims=True)
    exp_x_shifted = np.exp(x - x_max)
    return exp_x_shifted / np.sum(exp_x_shifted, axis=axis, keepdims=True)


def sample_top_p_k(probs, p, k, generator=None):
    if generator is None:
        generator = np.random
    probs_idx = np.argsort(-probs, axis=-1)
    probs_sort = np.take_along_axis(probs, probs_idx, -1)
    probs_sum = np.cumsum(probs_sort, axis=-1)
    mask = probs_sum - probs_sort > p
    probs_sort[mask] = 0.0
    mask = np.zeros(probs_sort.shape[-1])
    mask[:k] = 1
    probs_sort = probs_sort * mask
    probs_sort /= np.sum(probs_sort, axis=-1, keepdims=True)
    shape = probs_sort.shape
    probs_sort_flat = probs_sort.reshape(-1, shape[-1])
    probs_idx_flat = probs_idx.reshape(-1, shape[-1])
    next_token = np.stack([generator.choice(idxs, p=pvals) for pvals, idxs in zip(probs_sort_flat, probs_idx_flat)])
    next_token = next_token.reshape(*shape[:-1])
    return next_token

def apply_io_binding(model: rt.InferenceSession, inputs, outputs, batch_size, past_len, cur_len):
    io_binding = model.io_binding()
    for input_ in  model.get_inputs():
        name = input_.name
        if name.startswith("past_key_values"):
            present_name = name.replace("past_key_values", "present")
            if present_name in outputs:
                v = outputs[present_name]
                if past_len > 4095:
                    v = v.numpy()
                    v = v[:, :, -4095:]
                    v = rt.OrtValue.ortvalue_from_numpy(v, device_type=device)
            else:
                v = rt.OrtValue.ortvalue_from_shape_and_type(
                    (batch_size, input_.shape[1], past_len, input_.shape[3]),
                    element_type=np.float32,
                    device_type=device)
            inputs[name] = v
        else:
            v = inputs[name]
        io_binding.bind_ortvalue_input(name, v)

    for output in model.get_outputs():
        name = output.name
        if name.startswith("present"):
            v = rt.OrtValue.ortvalue_from_shape_and_type(
                (batch_size, output.shape[1], cur_len, output.shape[3]),
                element_type=np.float32,
                device_type=device)
            outputs[name] = v
        else:
            v = outputs[name]
        io_binding.bind_ortvalue_output(name, v)
    return io_binding

def generate(model, prompt=None, batch_size=1, max_len=512, temp=1.0, top_p=0.98, top_k=20,
             disable_patch_change=False, disable_control_change=False, disable_channels=None, generator=None, cancel=None):
    tokenizer = model[2]
    if disable_channels is not None:
        disable_channels = [tokenizer.parameter_ids["channel"][c] for c in disable_channels]
    else:
        disable_channels = []
    if generator is None:
        generator = np.random
    max_token_seq = tokenizer.max_token_seq
    if prompt is None:
        input_tensor = np.full((1, max_token_seq), tokenizer.pad_id, dtype=np.int64)
        input_tensor[0, 0] = tokenizer.bos_id  # bos
        input_tensor = input_tensor[None, :, :]
        input_tensor = np.repeat(input_tensor, repeats=batch_size, axis=0)
    else:
        if len(prompt.shape) == 2:
            prompt = prompt[None, :]
            prompt = np.repeat(prompt, repeats=batch_size, axis=0)
        elif prompt.shape[0] == 1:
            prompt = np.repeat(prompt, repeats=batch_size, axis=0)
        elif len(prompt.shape) != 3 or prompt.shape[0] != batch_size:
            raise ValueError(f"invalid shape for prompt, {prompt.shape}")
        prompt = prompt[..., :max_token_seq]
        if prompt.shape[-1] < max_token_seq:
            prompt = np.pad(prompt, ((0, 0), (0, 0), (0, max_token_seq - prompt.shape[-1])),
                            mode="constant", constant_values=tokenizer.pad_id)
        input_tensor = prompt
    input_tensor = input_tensor[:, -4096:]
    cur_len = input_tensor.shape[1]
    bar = contextlib.nullcontext()
    model0_inputs = {}
    model0_outputs = {}
    emb_size = 1024
    for output in model[0].get_outputs():
        if output.name == "hidden":
            emb_size = output.shape[2]
    past_len = 0
    with bar:
        while cur_len < max_len:
            if cancel: cancel()
            end = [False] * batch_size
            model0_inputs["x"] = rt.OrtValue.ortvalue_from_numpy(input_tensor[:, past_len:], device_type=device)
            model0_outputs["hidden"] = rt.OrtValue.ortvalue_from_shape_and_type(
                (batch_size, cur_len - past_len, emb_size),
                element_type=np.float32,
                device_type=device)
            io_binding = apply_io_binding(model[0], model0_inputs, model0_outputs, batch_size, past_len, cur_len)
            io_binding.synchronize_inputs()
            model[0].run_with_iobinding(io_binding)
            io_binding.synchronize_outputs()

            hidden = model0_outputs["hidden"].numpy()[:, -1:]
            next_token_seq = np.zeros((batch_size, 0), dtype=np.int64)
            event_names = [""] * batch_size
            model1_inputs = {"hidden": rt.OrtValue.ortvalue_from_numpy(hidden, device_type=device)}
            model1_outputs = {}
            for i in range(max_token_seq):
                mask = np.zeros((batch_size, tokenizer.vocab_size), dtype=np.int64)
                for b in range(batch_size):
                    if end[b]:
                        mask[b, tokenizer.pad_id] = 1
                        continue
                    if i == 0:
                        mask_ids = list(tokenizer.event_ids.values()) + [tokenizer.eos_id]
                        if disable_patch_change:
                            mask_ids.remove(tokenizer.event_ids["patch_change"])
                        if disable_control_change:
                            mask_ids.remove(tokenizer.event_ids["control_change"])
                        mask[b, mask_ids] = 1
                    else:
                        param_names = tokenizer.events[event_names[b]]
                        if i > len(param_names):
                            mask[b, tokenizer.pad_id] = 1
                            continue
                        param_name = param_names[i - 1]
                        mask_ids = tokenizer.parameter_ids[param_name]
                        if param_name == "track":
                            mask_ids = mask_ids[:1]  # Nova melody scope: one track
                        if param_name == "channel":
                            mask_ids = [i for i in mask_ids if i not in disable_channels]
                        mask[b, mask_ids] = 1
                mask = mask[:, None, :]
                x = next_token_seq
                if i != 0:
                    # cached
                    if i == 1:
                        hidden = np.zeros((batch_size, 0, emb_size), dtype=np.float32)
                        model1_inputs["hidden"] = rt.OrtValue.ortvalue_from_numpy(hidden, device_type=device)
                    x = x[:, -1:]
                model1_inputs["x"] = rt.OrtValue.ortvalue_from_numpy(x, device_type=device)
                model1_outputs["y"] = rt.OrtValue.ortvalue_from_shape_and_type(
                    (batch_size, 1, tokenizer.vocab_size),
                    element_type=np.float32,
                    device_type=device
                )
                io_binding = apply_io_binding(model[1], model1_inputs, model1_outputs, batch_size, i, i+1)
                io_binding.synchronize_inputs()
                if cancel: cancel()
                model[1].run_with_iobinding(io_binding)
                io_binding.synchronize_outputs()
                logits = model1_outputs["y"].numpy()
                scores = softmax(logits / temp, -1) * mask
                samples = sample_top_p_k(scores, top_p, top_k, generator)
                if i == 0:
                    next_token_seq = samples
                    for b in range(batch_size):
                        if end[b]:
                            continue
                        eid = samples[b].item()
                        if eid == tokenizer.eos_id:
                            end[b] = True
                        else:
                            event_names[b] = tokenizer.id_events[eid]
                else:
                    next_token_seq = np.concatenate([next_token_seq, samples], axis=1)
                    if all([len(tokenizer.events[event_names[b]]) == i for b in range(batch_size) if not end[b]]):
                        break
            if next_token_seq.shape[1] < max_token_seq:
                next_token_seq = np.pad(next_token_seq,
                                        ((0, 0), (0, max_token_seq - next_token_seq.shape[-1])),
                                        mode="constant", constant_values=tokenizer.pad_id)
            next_token_seq = next_token_seq[:, None, :]
            input_tensor = np.concatenate([input_tensor, next_token_seq], axis=1)
            past_len = cur_len
            cur_len += 1
            yield next_token_seq[:, 0]
            if all(end):
                break
