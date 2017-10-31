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
  
  
  // This causes frames that are captured while the dispatch queue
  // is in the Output Capture method to be ignored
  videoDataOutput.alwaysDiscardsLateVideoFrames = YES;
  
  // begin configure capture session
  [_captureSession beginConfiguration];
  
  if (![_captureSession canAddOutput:videoDataOutput])
  {
    NSLog(@"Cannot add video data output");
    _captureSession = nil;
    return;
  }
  
  // connect the video device input and video data and still image outputs
  [_captureSession addInput:videoDeviceInput];
  
  // added by babak to select highest frame rate:
  AVCaptureDeviceFormat *bestFormat = nil;
  AVFrameRateRange *bestFrameRateRange = nil;
  for ( AVCaptureDeviceFormat *format in [_videoDevice formats] ) {
    NSLog(@"~~~~~~~~~~~~~~");
    for ( AVFrameRateRange *range in format.videoSupportedFrameRateRanges ) {
      if ( range.maxFrameRate == 60 ) {
        bestFormat = format;
        bestFrameRateRange = range;
        NSLog(@"--- Switching to frame rate  : %f, %f\n",range.minFrameRate,range.maxFrameRate);
      }
    }
  }
  if ( bestFormat ) {
    if ( [_videoDevice lockForConfiguration:NULL] == YES ) {
      _videoDevice.activeFormat = bestFormat;
      _videoDevice.activeVideoMinFrameDuration = bestFrameRateRange.minFrameDuration;
      _videoDevice.activeVideoMaxFrameDuration = bestFrameRateRange.minFrameDuration;
      NSLog(@"--- Selected as highest framerate  : %lld, %d\n",bestFrameRateRange.minFrameDuration.value,bestFrameRateRange.minFrameDuration.timescale);
      [_videoDevice unlockForConfiguration];
    }
  }

  NSLog(@"Semi Final 3 spec:: %lld, %d\n", _videoDevice.activeVideoMinFrameDuration.value, _videoDevice.activeVideoMinFrameDuration.timescale);
  
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
  
  // Lock the buffer so that it can be accessed with the CPU
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
  
  // Get the base address and access the pixels directly
  unsigned char *rawData = CVPixelBufferGetBaseAddress(imageBuffer);
  NSUInteger bytesPerPixel = bytes_per_pixel;

  int x = 0;
  int y = 0;
  uint64_t totalRed = 0;
  uint64_t totalGreen = 0;
  uint64_t totalBlue = 0;
  //int total_alpha = 0;
  
  // NSLog(@"width: %d, height: %d, bytesperow: %d, bytesperpixel: %d\n",width,height,bytesPerRow,bytesPerPixel);
  
  const int stepSize = 25;
  for (int n = 0; n < (width * height); n += stepSize){

    unsigned long index = (bytesPerRow * y) + x * bytesPerPixel;
    // Image stored in BGRA
    unsigned int blue  = rawData[index];
    unsigned int green = rawData[index + 1];
    unsigned int red   = rawData[index + 2];
    //int alpha = rawData[index + 3];

    totalRed += red;
    totalGreen += green;
    totalBlue += blue;
    
    // Ensure that x resets to zero after a full line has been examined
    x = (x + stepSize) % width;

    // If at start of new line, increase y accordingly
    if (x == 0) {
      y++;
    }
  }
  // Done with computation, release buffer
  CVPixelBufferUnlockBaseAddress(imageBuffer, kCVPixelBufferLock_ReadOnly);
  

  // Take avg * 10 by dividing brightness by 1/10 the number of pixels examined
  const int scalingFactor = 10;
  totalRed /= (width*height/(stepSize * scalingFactor));
  totalGreen /= (width*height/(stepSize * scalingFactor));
  totalBlue /= (width*height/(stepSize * scalingFactor));
  
  unsigned int brightness = sqrt(totalRed * totalRed * 0.241 + totalBlue * totalBlue * 0.068 + totalGreen * totalGreen * 0.691);

  //NSLog(@"Total Red: %d\n",total_red);
  
  // Max value for any pixel is 255 as it is represented as an 8 bit uint
  NSString* str = [NSString stringWithFormat:@"%d",
                   255 * scalingFactor - brightness];
  
  [self sendEventWithName:@"sayHello" body:str];
}

@end
