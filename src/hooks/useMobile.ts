'use client';

import { useState, useEffect } from 'react';

// SSR-safe mobile detection without react-device-detect
function detectMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function detectTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent);
}

function detectMobileOnly(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

interface UseMobileReturn {
  isMobileDevice: boolean;
  isTabletDevice: boolean;
  isMobileOnly: boolean;
  isSmallScreen: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

export function useMobile(): UseMobileReturn {
  const [screenWidth, setScreenWidth] = useState(0);
  const [screenHeight, setScreenHeight] = useState(0);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isMobileOnlyFlag, setIsMobileOnlyFlag] = useState(false);

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setScreenWidth(width);
      setScreenHeight(height);
      setIsSmallScreen(width < 768);
      setOrientation(width > height ? 'landscape' : 'portrait');
    };

    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is a legacy property
        navigator.msMaxTouchPoints > 0
      );
    };

    const checkDeviceType = () => {
      setIsMobile(detectMobileDevice());
      setIsTablet(detectTabletDevice());
      setIsMobileOnlyFlag(detectMobileOnly());
    };

    updateDimensions();
    checkTouch();
    checkDeviceType();

    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  return {
    isMobileDevice: isMobile || isSmallScreen,
    isTabletDevice: isTablet,
    isMobileOnly: isMobileOnlyFlag,
    isSmallScreen,
    isTouchDevice,
    screenWidth,
    screenHeight,
    orientation,
  };
}

// Simple context-free check for SSR
export function getIsMobileSSR(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || detectMobileDevice();
}
