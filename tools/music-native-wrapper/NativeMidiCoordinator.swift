import Foundation
import WebKit
final class NativeMidiCoordinator{private let webBridge:MusicStudioWebMidiBridge;private lazy var midiBridge=CoreMidiInputBridge{[weak self] bytes in self?.webBridge.sendNoteMessage(bytes)};init(webView:WKWebView,platform:String){webBridge=MusicStudioWebMidiBridge(webView:webView);webBridge.installCapabilityMetadata(platform:platform)};@discardableResult func start()->OSStatus{midiBridge.start()};func stop(){midiBridge.stop()}}
