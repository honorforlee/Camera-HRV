//
//  CameraController.m
//  CameraHRV
//
//  Created by Babak Moatamed on 8/28/17.
//  Copyright © 2017 Facebook. All rights reserved.
//

#import "CameraController.h"
#import <AssetsLibrary/AssetsLibrary.h>
#import "CameraController.h"
#import <AVFoundation/AVFoundation.h>
#import <CoreImage/CoreImage.h>
#import <React/RCTUtils.h>
#import <Accelerate/Accelerate.h>
#include "math.h"
#import <GLKit/GLKit.h>
#import "AppDelegate.h"
@interface CameraController () <AVCaptureVideoDataOutputSampleBufferDelegate>
//
//  ViewController.m
//  RealtimeVideoFilter
//
//  Created by Altitude Labs on 23/12/15.
//  Copyright © 2015 Victor. All rights reserved.
//




@property GLKView *videoPreviewView;
@property CIContext *ciContext;
@property EAGLContext *eaglContext;
@property CGRect videoPreviewViewBounds;

@property AVCaptureDevice *videoDevice;
@property AVCaptureSession *captureSession;
@property dispatch_queue_t captureSessionQueue;
@property int testn;
@end

@implementation CameraController

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[@"sayHello"];
}


RCT_EXPORT_METHOD(turnTorchOn: (BOOL) on) {
  // check if flashlight available
  Class captureDeviceClass = NSClassFromString(@"AVCaptureDevice");
  if (captureDeviceClass != nil) {
    AVCaptureDevice *device = [AVCaptureDevice defaultDeviceWithMediaType:AVMediaTypeVideo];
    if ([device hasTorch] && [device hasFlash]){
      
      [device lockForConfiguration:nil];
      if (on) {
        [device setTorchMode:AVCaptureTorchModeOn];
        [device setFlashMode:AVCaptureFlashModeOn];
        //torchIsOn = YES; //define as a variable/property if you need to know status
      } else {
        [device setTorchMode:AVCaptureTorchModeOff];
        [device setFlashMode:AVCaptureFlashModeOff];
        //torchIsOn = NO;
      }
      [device unlockForConfiguration];
    }
  }
  
}

RCT_EXPORT_METHOD (stop){
#if TARGET_IPHONE_SIMULATOR
  //return;
#endif
  dispatch_async(self.captureSessionQueue, ^{
//    [self.previewLayer removeFromSuperlayer];
    [self.captureSession commitConfiguration];
    [self.captureSession stopRunning];
    for(AVCaptureInput *input in self.captureSession.inputs) {
      [self.captureSession removeInput:input];
    }
    
    for(AVCaptureOutput *output in self.captureSession.outputs) {
      [self.captureSession removeOutput:output];
    }
  });
}


RCT_EXPORT_METHOD(start)
{
  NSLog(@"start\n");
  _testn = 0;
  // get the input device and also validate the settings
  NSArray *videoDevices = [AVCaptureDevice devicesWithMediaType:AVMediaTypeVideo];
  
  
  // Set to use the rear camera on the device
  AVCaptureDevicePosition position = AVCaptureDevicePositionBack;
  
  for (AVCaptureDevice *device in videoDevices)
  {
    if (device.position == position) {
      _videoDevice = device;
      break;
    }
  }
  
  // added by babak for frame rate:
//  AVCaptureDeviceFormat *bestFormat = nil;
//  AVFrameRateRange *bestFrameRateRange = nil;
//  for ( AVCaptureDeviceFormat *format in [_videoDevice formats] ) {
//    NSLog(@"~~~~~~~~~~~~~~");
//    for ( AVFrameRateRange *range in format.videoSupportedFrameRateRanges ) {
//      if ( range.maxFrameRate > bestFrameRateRange.maxFrameRate ) {
//        bestFormat = format;
//        bestFrameRateRange = range;
//        NSLog(@"--- Apparently working with  : %f, %f\n",range.minFrameRate,range.maxFrameRate);
//      }
//    }
//  }
//  if ( bestFormat ) {
//    if ( [_videoDevice lockForConfiguration:NULL] == YES ) {
//      _videoDevice.activeFormat = bestFormat;
//      _videoDevice.activeVideoMinFrameDuration = bestFrameRateRange.minFrameDuration;
//      _videoDevice.activeVideoMaxFrameDuration = bestFrameRateRange.minFrameDuration;
//      NSLog(@"--- settle with  : %lld, %d\n",bestFrameRateRange.minFrameDuration.value,bestFrameRateRange.minFrameDuration.timescale);
//      [_videoDevice unlockForConfiguration];
//    }
//  }
//

//    NSError *errors;
//    CMTime frameDuration = CMTimeMake(1, 60);
//    NSArray *supportedFrameRateRanges = [_videoDevice.activeFormat videoSupportedFrameRateRanges];
//    BOOL frameRateSupported = NO;
//    for (AVFrameRateRange *range in supportedFrameRateRanges) {
//      NSLog(@"--- First Frame Rate:--- min: %f, max: %f\n",range.minFrameRate,range.maxFrameRate);
//      if (CMTIME_COMPARE_INLINE(frameDuration, >=, range.minFrameDuration) &&
//          CMTIME_COMPARE_INLINE(frameDuration, <=, range.maxFrameDuration)) {
//        frameRateSupported = YES;
//      }
//    }
//
//    if (frameRateSupported && [_videoDevice lockForConfiguration:&errors]) {
//      [_videoDevice setActiveVideoMaxFrameDuration:frameDuration];
//      [_videoDevice setActiveVideoMinFrameDuration:frameDuration];
//      [_videoDevice unlockForConfiguration];
//      NSLog(@"---Frame Rate:--- Succeded\n");
//    }
//    else
//      NSLog(@"---Frame Rate:--- Not Succeded :(\n");
//
//
//    for (AVCaptureDeviceFormat *vFormat in _videoDevice.formats) {
//
//      // 2
//      NSArray<AVFrameRateRange *> *ranges = vFormat.videoSupportedFrameRateRanges;
//      AVFrameRateRange *frameRates = ranges[0];
//
//      NSLog(@"---Frame Rate:---  %f, %f , %@\n",frameRates.minFrameRate, frameRates.maxFrameRate, vFormat.mediaType);
//      // 3
//
//    }
  //---------------------------


  
  // obtain device input
  NSError *error = nil;
  AVCaptureDeviceInput *videoDeviceInput = [AVCaptureDeviceInput deviceInputWithDevice:_videoDevice error:&error];
  if (!videoDeviceInput)
  {
    NSLog(@"%@", [NSString stringWithFormat:@"Unable to obtain video device input, error: %@", error]);
    return;
  }
  
  // obtain the preset and validate the preset
  NSString *preset = AVCaptureSessionPresetHigh;
  if (![_videoDevice supportsAVCaptureSessionPreset:preset])
  {
    NSLog(@"%@", [NSString stringWithFormat:@"Capture session preset not supported by video device: %@", preset]);
    return;
  }
  
  // create the capture session
  _captureSession = [[AVCaptureSession alloc] init];
  _captureSession.sessionPreset = preset;
  
  
  // CoreImage wants BGRA pixel format
  NSDictionary *outputSettings = @{ (id)kCVPixelBufferPixelFormatTypeKey : [NSNumber numberWithInteger:kCVPixelFormatType_32BGRA]};
  // create and configure video data output
  AVCaptureVideoDataOutput *videoDataOutput = [[AVCaptureVideoDataOutput alloc] init];
  videoDataOutput.videoSettings = outputSettings;
  
  // create the dispatch queue for handling capture session delegate method calls
  _captureSessionQueue = dispatch_queue_create("capture_session_queue", NULL);
  [videoDataOutput setSampleBufferDelegate:self queue:_captureSessionQueue];
  
  
  // This blocks frames that are captured while the dispatch queue
  // is in the Output Capture method
  videoDataOutput.alwaysDiscardsLateVideoFrames = YES;
  
  // begin configure capture session
  [_captureSession beginConfiguration];
  
  if (![_captureSession canAddOutput:videoDataOutput])
  {
    NSLog(@"Cannot add video data output");
    _captureSession = nil;
    return;
  }
  
    NSLog(@"Semi Final 3 spec:: %lld, %d\n", _videoDevice.activeVideoMinFrameDuration.value, _videoDevice.activeVideoMinFrameDuration.timescale);

  // connect the video device input and video data and still image outputs
  [_captureSession addInput:videoDeviceInput];
  
  // --- added by babak:
//  bool found_format = 0;
//  for ( AVCaptureDeviceFormat *format in [_videoDevice formats] ) {
//    NSLog(@"~~~~~~~~~~~~~~");
//    for ( AVFrameRateRange *range in format.videoSupportedFrameRateRanges ) {
//      if ( range.maxFrameRate > bestFrameRateRange.maxFrameRate ) {
//        bestFormat = format;
//        bestFrameRateRange = range;
//        NSLog(@"--- Apparently working with  : %f, %f\n",range.minFrameRate,range.maxFrameRate);
//        if(range.maxFrameRate == 600){
//          found_format = 1;
//          break;
//        }
//      }
//    }
//    if(found_format)
//      break;
//  }
//  if ( bestFormat ) {
//    if ( [_videoDevice lockForConfiguration:NULL] == YES ) {
//      _videoDevice.activeFormat = bestFormat;
//      _videoDevice.activeVideoMinFrameDuration = bestFrameRateRange.minFrameDuration;
//      _videoDevice.activeVideoMaxFrameDuration = bestFrameRateRange.minFrameDuration;
//      NSLog(@"--- settle with  : %lld, %d\n",bestFrameRateRange.minFrameDuration.value,bestFrameRateRange.minFrameDuration.timescale);
//      [_videoDevice unlockForConfiguration];
//    }
//  }
  //-----------------

  [_captureSession addOutput:videoDataOutput];
  [_captureSession commitConfiguration];
  
  
  
  NSLog(@"Final spec:: %lld, %d\n", _videoDevice.activeVideoMinFrameDuration.value, _videoDevice.activeVideoMinFrameDuration.timescale);
  
  // then start everything
  [_captureSession startRunning];
}


- (void)captureOutput:(AVCaptureOutput *)captureOutput didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer fromConnection:(AVCaptureConnection *)connection
{
  NSLog(@"captureoutput\n %d",_testn);
  self.testn = self.testn + 1;
  
  // Get a reference to the image within the sample buffer.
  // Not owned by captureOutput
  CVImageBufferRef imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
  CVPixelBufferLockBaseAddress(imageBuffer, kCVPixelBufferLock_ReadOnly);
  
  size_t width  = CVPixelBufferGetWidth(imageBuffer);
  size_t height = CVPixelBufferGetHeight(imageBuffer);
  
  size_t bytesPerRow = CVPixelBufferGetBytesPerRow(imageBuffer);
  
  // For now, we assume each pixel is 8 bits, and 4 layers per pixel
  // This is because we set CVPixelFormatType_32BGRA up above

  size_t bpp = 32;
  size_t bpc = 8;
  //NSLog(@"bpc: %lu\n",bpc);
  
  if(bpc == 0){
    bpc = 1;
    width = 1;
    height = 1;
  }
  size_t bytes_per_pixel = bpp / bpc;
  
  unsigned char *rawData = CVPixelBufferGetBaseAddress(imageBuffer);
  NSUInteger bytesPerPixel = bytes_per_pixel;

  int x = 0;
  int y = 0;
  int total_red = 0;
  int total_green = 0;
  int total_blue = 0;
  //int total_alpha = 0;
  int brightness = 0;
  
  // NSLog(@"width: %d, height: %d, bytesperow: %d, bytesperpixel: %d\n",width,height,bytesPerRow,bytesPerPixel);
  
  for (int n = 0; n<(width*height); n+=50){

    unsigned long index = (bytesPerRow * y) + x * bytesPerPixel;
    // Image stored in BGRA
    int blue  = rawData[index];
    int green = rawData[index + 1];
    int red   = rawData[index + 2];
    //int alpha = rawData[index + 3];

    total_red += red;
    total_green += green;
    total_blue += blue;

    /* NSArray * a = [NSArray arrayWithObjects:[NSString stringWithFormat:@"%i",red],[NSString stringWithFormat:@"%i",green],[NSString stringWithFormat:@"%i",blue],[NSString stringWithFormat:@"%i",alpha], nil];
     [colours addObject:a];
     */
    x+=50;
    if (x==width){
      x=0;
      y++;
    }
  }
  CVPixelBufferUnlockBaseAddress(imageBuffer, kCVPixelBufferLock_ReadOnly);
  
  // TODO(Tyler): Check for null as the returned value from malloc
//  float *redVector = malloc(numPixels * sizeof(float32_t));
//  float *greenVector = malloc(numPixels * sizeof(float32_t));
//  float *blueVector = malloc(numPixels * sizeof(float32_t));

  
  // Convert image to floats so that accelerate may be used
//  vDSP_vfltu8(rawData, 4, redVector, 1, numPixels);
//  vDSP_vfltu8(rawData + 1, 4, greenVector, 1, numPixels);
//  vDSP_vfltu8(rawData + 2, 4, blueVector, 1, numPixels);

  
  total_red /= (width*height/500);
  total_green /= (width*height/500);
  total_blue /= (width*height/500);
  
//  float avgRed;
//  float avgBlue;
//  float avgGreen;
  
  // Find average of each color in the image
//  vDSP_meamgv(redVector, 1, &avgRed, 1);
//  vDSP_meamgv(blueVector, 1, &avgBlue, 1);
//  vDSP_meamgv(greenVector, 1, &avgGreen, 1);

  brightness = sqrt(total_red * total_red * 0.241+ total_blue * total_blue * 0.068 + total_green * total_green * 0.691);
//  brightness = sqrt(pow(avgRed, 2.0) * 0.241 + pow(avgBlue, 2.0) * 0.068 + pow(avgGreen, 2.0) * 0.691);
  
//  free(redVector);
//  free(blueVector);
//  free(greenVector);


  //NSLog(@"Total Red: %d\n",total_red);
  
  NSString* str = [NSString stringWithFormat:@"%d",brightness];
  [self sendEventWithName:@"sayHello" body:str];

  
  
  //----------
  // Image processing
//  CIFilter * vignetteFilter = [CIFilter filterWithName:@"CIVignetteEffect"];
//  [vignetteFilter setValue:sourceImage forKey:kCIInputImageKey];
//  [vignetteFilter setValue:[CIVector vectorWithX:sourceExtent.size.width/2 Y:sourceExtent.size.height/2] forKey:kCIInputCenterKey];
//  [vignetteFilter setValue:@(sourceExtent.size.width/2) forKey:kCIInputRadiusKey];
//  CIImage *filteredImage = [vignetteFilter outputImage];
//
//  CIFilter *effectFilter = [CIFilter filterWithName:@"CIPhotoEffectInstant"];
//  [effectFilter setValue:filteredImage forKey:kCIInputImageKey];
//  filteredImage = [effectFilter outputImage];
//
//
//  CGFloat sourceAspect = sourceExtent.size.width / sourceExtent.size.height;
//  CGFloat previewAspect = _videoPreviewViewBounds.size.width  / _videoPreviewViewBounds.size.height;
//
//  // we want to maintain the aspect radio of the screen size, so we clip the video image
//  CGRect drawRect = sourceExtent;
//  if (sourceAspect > previewAspect)
//  {
//    // use full height of the video image, and center crop the width
//    drawRect.origin.x += (drawRect.size.width - drawRect.size.height * previewAspect) / 2.0;
//    drawRect.size.width = drawRect.size.height * previewAspect;
//  }
//  else
//  {
//    // use full width of the video image, and center crop the height
//    drawRect.origin.y += (drawRect.size.height - drawRect.size.width / previewAspect) / 2.0;
//    drawRect.size.height = drawRect.size.width / previewAspect;
//  }
//
//  [_videoPreviewView bindDrawable];
//
//  if (_eaglContext != [EAGLContext currentContext])
//    [EAGLContext setCurrentContext:_eaglContext];
//
//  // clear eagl view to grey
//  glClearColor(0.5, 0.5, 0.5, 1.0);
//  glClear(GL_COLOR_BUFFER_BIT);
//
//  // set the blend mode to "source over" so that CI will use that
//  glEnable(GL_BLEND);
//  glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
//
//  if (filteredImage)
//    [_ciContext drawImage:filteredImage inRect:_videoPreviewViewBounds fromRect:drawRect];
//
//  [_videoPreviewView display];
}

@end
