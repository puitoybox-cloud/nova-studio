# PR #250 M1 iPad verification environment

This directory combines two immutable inputs without merging either product PR:

- Product: PR #250 at `2803e5f697da1a40cc6dc1db8fde886af0521f1a`
- Native foundation: PR #248 at `5f3454ba85620c00054f7dfdcc4bf301496007cd`
  (including PR #247 at `f88976e3f83fdec6ad0bf7b02955a63bf874ee77`)

`VerificationProduct/` is a byte-for-byte snapshot of the PR #250 runtime files.
The Xcode targets load that local snapshot and never load the GitHub Pages product,
so CDN caches cannot change this verification run.
The native wrapper injects a visible marker containing the full PR #250 HEAD.

The iPad target declares an iPad-only device family, a generated launch screen,
landscape orientations, and full-screen presentation. SwiftUI keeps the system
status-bar safe area black while allowing the web view to consume the complete
horizontal and bottom app area.

Open `MusicStudioNative.xcodeproj`, select `MusicStudioiPad`, select the connected
iPad, and Run. Signing uses Xcode's automatic signing and the local development
team selected by the operator.
