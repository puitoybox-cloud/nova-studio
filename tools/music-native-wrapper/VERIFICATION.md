# PR #250 M1 iPad verification environment

This directory combines two immutable inputs without merging either product PR:

- Product: PR #250 at `b299b74e5fde07cfc5dd6d4203312c24d03e89ed`
- Native foundation: PR #248 at `5f3454ba85620c00054f7dfdcc4bf301496007cd`
  (including PR #247 at `f88976e3f83fdec6ad0bf7b02955a63bf874ee77`)

`VerificationProduct/` is a byte-for-byte snapshot of the PR #250 runtime files.
The Xcode targets load that local snapshot and never load the GitHub Pages product.
The native wrapper injects a visible marker containing the full PR #250 HEAD.

Open `MusicStudioNative.xcodeproj`, select `MusicStudioiPad`, select the connected
iPad, and Run. Signing uses Xcode's automatic signing and the local development
team selected by the operator.
