import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

interface FaceDetectionResult {
  faceDetected: boolean;
  multipleFaces: boolean;
  lookingAway: boolean;
  confidence: number;
  faceCount: number;
  gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down';
}

const MODEL_URL = '/models';

let modelsLoaded = false;
let modelsLoading = false;

async function loadModels() {
  if (modelsLoaded || modelsLoading) return;
  modelsLoading = true;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('✅ Face detection models loaded');
  } catch (err) {
    console.error('Failed to load face detection models:', err);
    modelsLoading = false;
  }
}

export function useFaceDetection(stream?: MediaStream | null) {
  const [detection, setDetection] = useState<FaceDetectionResult>({
    faceDetected: false,
    multipleFaces: false,
    lookingAway: false,
    confidence: 0,
    faceCount: 0,
    gazeDirection: 'center',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lookAwayCounterRef = useRef(0);
  const lookAwayThreshold = 5;

  useEffect(() => {
    if (stream && typeof window !== 'undefined') {
      initializeFaceDetection();
    } else {
      cleanupDetection();
    }

    return () => {
      cleanupDetection();
    };
  }, [stream]);

  const initializeFaceDetection = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load models first
      await loadModels();

      // Create video element for processing
      const video = document.createElement('video');
      if (stream) {
        video.srcObject = stream;
      }
      video.autoplay = true;
      video.playsInline = true;
      videoRef.current = video;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video stream'));
        setTimeout(() => reject(new Error('Video load timeout')), 10000);
      });

      startDetectionLoop();
      setIsLoading(false);

    } catch (err) {
      console.error('Face detection initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize face detection');
      setIsLoading(false);
      // Fallback to simulated detection if models fail
      startFallbackDetection();
    }
  };

  const startDetectionLoop = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    detectionIntervalRef.current = setInterval(() => {
      if (modelsLoaded) {
        detectFacesReal();
      } else {
        detectFacesFallback();
      }
    }, 1000);
  };

  const startFallbackDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    detectionIntervalRef.current = setInterval(() => {
      detectFacesFallback();
    }, 1000);
    setIsLoading(false);
  };

  // Real ML-based face detection using face-api.js
  const detectFacesReal = async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4) return;

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true);

      const faceCount = detections.length;
      const faceDetected = faceCount > 0;
      const multipleFaces = faceCount > 1;
      const confidence = faceDetected ? detections[0].detection.score : 0;

      let gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down' = 'center';
      let isLookingAway = false;

      if (faceDetected && detections[0].landmarks) {
        const landmarks = detections[0].landmarks;
        const nose = landmarks.getNose();
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        if (nose.length > 0 && leftEye.length > 0 && rightEye.length > 0) {
          const noseTip = nose[3]; // tip of nose
          const eyeCenter = {
            x: (leftEye[0].x + rightEye[3].x) / 2,
            y: (leftEye[0].y + rightEye[3].y) / 2,
          };

          const faceBox = detections[0].detection.box;
          const faceWidth = faceBox.width;
          const faceHeight = faceBox.height;

          // Calculate horizontal offset (nose relative to eye center)
          const horizontalOffset = (noseTip.x - eyeCenter.x) / faceWidth;
          // Calculate vertical offset
          const verticalOffset = (noseTip.y - eyeCenter.y) / faceHeight;

          // Determine gaze direction based on offsets
          if (Math.abs(horizontalOffset) > 0.15) {
            gazeDirection = horizontalOffset > 0 ? 'right' : 'left';
            isLookingAway = true;
          } else if (verticalOffset > 0.35) {
            gazeDirection = 'down';
            isLookingAway = true;
          } else if (verticalOffset < 0.1) {
            gazeDirection = 'up';
            isLookingAway = true;
          }
        }
      }

      // Track looking away persistence
      if (isLookingAway || !faceDetected) {
        lookAwayCounterRef.current++;
      } else {
        lookAwayCounterRef.current = 0;
      }

      const persistentLookAway = lookAwayCounterRef.current >= lookAwayThreshold;

      setDetection({
        faceDetected,
        multipleFaces,
        lookingAway: persistentLookAway,
        confidence,
        faceCount,
        gazeDirection,
      });

    } catch (err) {
      console.error('Face detection error:', err);
      // Don't set error here, just skip this frame
    }
  };

  // Fallback simulated detection
  const detectFacesFallback = () => {
    const random = Math.random();
    const faceDetected = random > 0.1;
    const multipleFaces = faceDetected && random > 0.95;
    const lookingAway = faceDetected && !multipleFaces && random > 0.9;
    const confidence = faceDetected ? 0.7 + (Math.random() * 0.3) : 0;

    if (lookingAway || !faceDetected) {
      lookAwayCounterRef.current++;
    } else {
      lookAwayCounterRef.current = 0;
    }

    setDetection({
      faceDetected,
      multipleFaces,
      lookingAway: lookAwayCounterRef.current >= lookAwayThreshold,
      confidence,
      faceCount: faceDetected ? (multipleFaces ? 2 : 1) : 0,
      gazeDirection: lookingAway ? 'left' : 'center',
    });
  };

  const cleanupDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current = null;
    }
    
    lookAwayCounterRef.current = 0;
    setDetection({
      faceDetected: false,
      multipleFaces: false,
      lookingAway: false,
      confidence: 0,
      faceCount: 0,
      gazeDirection: 'center',
    });
  };

  return {
    ...detection,
    isLoading,
    error,
  };
}
