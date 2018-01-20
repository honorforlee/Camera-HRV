Camera-HRV
==================================
Camera-HRV is an iOS app for calculating a user's heart rate variability using a device's camera.

Device Requirements
============
* iOS device with camera and flash

The app has been tested on the iPhone 6 and newer, as well as iOS 11.0+. Screen sizes smaller than 4.7 inches may experience some difficulties, and devices older than the iPhone 6 may run unacceptably slow. For best performance, run on iPhone 7 or newer.

A camera flash is necessary to illuminate the user's finger.

Build Requirements
============
Tested with the following environment:
* React Native 0.52.0
* npm 5.5.1
* node v6.11.0
* watchman
* homebrew
* Xcode 9.2
* macOS 10.13.2

To set up the build environment, take the following steps:
1. If not already installed, install node.js, available [here](https://nodejs.org/en/download/). Alternatively, do `$brew install node` if you have homebrew installed.
2. The React Native developers recommend installing watchman for performance. To install, do ```$ brew install watchman```
3. From this project's root directory, run `npm install`. This should install all of the project's necessary dependencies.

At this point, the project can be opened and built in Xcode. To do this, open the `Camera-HRV/ios/CameraHRV2.xcodeproj` in Xcode.

Building
=========
This section pulls from the React Native documentation, available [here](https://facebook.github.io/react-native/docs/0.52/running-on-device.html) If any difficulties are encountered, refer to the React Native documentation.

Building for Simulator
=====
Open the project in Xcode, select an iOS simulator as the target, and choose run. Certain features will not be available in the simulator, such as the camera.

This should also be possible with the command `react-native run-ios` from the root of the project directory.

Building for Debug on a Device
========
When built in debug mode, output from `console.log()` and other logging commands are available through the Xcode log, as well as other debug tools, as detailed in the React Native documentation on debugging, available [here](https://facebook.github.io/react-native/docs/0.52/debugging.html). Additionally, building in debug mode brings the benefit of being able to reload the JavaScript portion of the app without needing to rebuild the entire app in Xcode. To do this, shake the device, and then select `Reload`. However, it will still be necessary to rebuild the app if any native code is changed. There is an additional option for `Live Reload`. With this setting turned on, the app will reload as soon as any JavaScript changes are saved.

Take the following steps when first building for debug, or as necessary as your machine's IP address changes.
1. First, configure code signing on your machine. instructions for this are [here](https://facebook.github.io/react-native/docs/0.52/running-on-device.html).
1. In Xcode, navigate to Product > Scheme > Edit Scheme. Here, select run in the sidebar, and then set `Build Configuration` to `debug`.
2. Navigate to `Camera-HRV/node_modules/react-native/ Libraries/WebSocket/RCTWebSocketExecutor.m`. Here, replace host with your IP address, in the following form. Here, `YOUR_IP` is your build machine's IP address.
```
NSString *host = [[_bridge bundleURL] host] ?: @"YOUR_IP";
```
**NOTE:** This step will need to be repeated every time your build machine's IP address changes. This IP is used for the mobile devices to locate the JavaScript files on the build machine.

3. Navigate to `Camera-HRV/ios/AppDelegate.m` and replace the `jsCodeLocation` line with the following, where `YOUR_IP` is your build machine's IP address:
```
jsCodeLocation = [NSURL URLWithString:@"http://YOUR_IP:8081/index.ios.bundle?platform=ios&dev=true"];
```
**NOTE:** This step will need to be repeated every time your build machine's IP address changes. This IP is used for the mobile devices to locate the machine it communicates with for debugging. It must also be performed whenever switching from building for production.

Lastly, to run the app, open the project in Xcode, select the device, and press run.


Building for Production on a Device
======

Building for production requires a few changes.

1. Configure code signing on your machine. Instructions for this are available [here](https://facebook.github.io/react-native/docs/0.52/running-on-device.html).
2. In Xcode, navigate to Product > Scheme > Edit Scheme. Here, select run in the sidebar, and then set `Build Configuration` to `release`.
3. Navigate to `Camera-HRV/ios/AppDelegate.m` and replace the `jsCodeLocation` line with the following:
```
 jsCodeLocation = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
```
This instructs the device to load code from the static bundle, rather than the dynamic loading it does in debug mode.

**NOTE:** This last step must be performed whenever switching away from debug mode.


Lastly, to run the app, open the project in Xcode, select the device, and press run.

To build so that the app can be distributed, press `⌘B` or select `Product -> Build`.

Misc
====
For style, we try to adhere to the Airbnb Javascript Style guide, available [here](https://www.airbnb.com). Tools such as `clang-format` may be used to help format code, though I can't guarantee they'll fit in with the style guide. I've been using ESlint, along with `eslint-config-airbnb eslint-plugin-import eslint-plugin-react eslint-plugin-jsx-a11y babel-eslint` to lint the project (these should be installed with npm install I believe). It's not perfect at present, but new code should be checked moving forward.
