"""Production snapshot aggregation; identity completeness is not native isolation."""
import copy


def aggregate(parent, child, closure, manifest):
    result = copy.deepcopy(parent)
    if result.get('mode') != 'STRICT':
        result.update(status='UNVERIFIED', complete=False, processingEligible=False)
        return result
    models = {e['identity']['id']: e for e in result.get('models', [])}
    errors = [item for item in result.get('missing',[]) if not item.startswith('models:')]
    if child is not None:
        models[child['model']['identity']['id']] = copy.deepcopy(child['model'])
        result['demucsReceipt'] = copy.deepcopy(child)
        if child.get('status') != 'LOADED' or child.get('lifetime') != 'LIVE_CHILD': errors.append('child-not-loaded-or-live')
        if child.get('child', {}).get('architecture') != result.get('architecture'): errors.append('child-architecture-mismatch')
        if child.get('native') != result.get('native'): errors.append('child-native-mismatch')
        if child.get('closure', {}).get('entries') != closure.get('entries'): errors.append('child-closure-mismatch')
    else: errors.append('missing-live-demucs-receipt')
    for entry in manifest['models']:
        actual = models.get(entry['id'])
        if actual is None or actual.get('identity') != entry or actual.get('status') != 'LOADED_VERIFIED_FILE': errors.append('missing-or-wrong-loaded-model:'+entry['id'])
    if set(models) != {e['id'] for e in manifest['models']}: errors.append('unexpected-loaded-model')
    if result.get('architecture') not in manifest['architectures']: errors.append('architecture-mismatch')
    for kind in ('native','assets'):
        present = {e.get('identity',e).get('id') for e in result.get(kind,[])}
        if kind == 'native' and not present: errors.append('missing-native-companion')
    observed = {e['identity']['id']:e for e in result.get('dependencies',[])}
    for entry in manifest['dependencies']:
        if observed.get(entry['id'],{}).get('identity') != entry: errors.append('missing-runtime-import:'+entry['id'])
    evidence = {e['id']: e for e in closure.get('entries', []) if e['kind'] == 'PYTHON_DISTRIBUTION'}
    for entry in manifest['dependencies']:
        actual = evidence.get(entry['id'])
        if actual is None or actual['status'] != 'VERIFIED_ARTIFACT' or actual['version'] != entry['version']: errors.append('missing-or-wrong-package-closure:'+entry['id'])
    if not closure.get('complete') or closure.get('status') != 'COMPLETE': errors.append('partial-scoped-closure')
    if result.get('status') == 'BLOCKED': errors.append('parent-blocked')
    for dependency in result.get('dependencies',[]):
        proof=evidence.get(dependency['identity']['id'])
        if proof and proof['status']=='VERIFIED_ARTIFACT':
            dependency['status']='VERIFIED_ARTIFACT'
            dependency['scope']='EXACT_APPROVED_DISTRIBUTION_RECORD'
    result.update(models=list(models.values()), scopedClosure=copy.deepcopy(closure),
        artifactClosure='VERIFIED' if not errors else 'UNVERIFIED', complete=not errors,
        status='VERIFIED' if not errors else 'PARTIAL', missing=errors,
        # No claim that Python auditing constrains native socket syscalls.
        enforcement={'pythonNetwork':'ENFORCED','pythonSubprocess':'EXACT_CHILD_ONLY','nativeNetwork':'UNVERIFIED'},
        processingEligible=False, publicationEligible=False)
    return result


def snapshot(runtime, session, closure):
    try:
        parent = runtime.snapshot()
        receipt = session.current() if session is not None else None
        return aggregate(parent, receipt, closure, runtime.manifest)
    except (ValueError, OSError):
        if session is not None: session.close()
        return {'inventoryVersion':2,'mode':'STRICT','status':'BLOCKED','complete':False,
            'processingEligible':False,'reason':'stale-or-dead-runtime-child'}
