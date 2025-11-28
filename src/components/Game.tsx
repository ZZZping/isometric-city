'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool } from '@/types/game';
import { useMobile } from '@/hooks/useMobile';
import { MobileToolbar } from '@/components/mobile/MobileToolbar';
import { MobileTopBar } from '@/components/mobile/MobileTopBar';

// Import shadcn components
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCheatCodes } from '@/hooks/useCheatCodes';
import { VinnieDialog } from '@/components/VinnieDialog';
import { CommandMenu } from '@/components/ui/CommandMenu';
import { Toast } from '@/components/ui/Toast';

// Import game components
import { OverlayMode } from '@/components/game/types';
import { getOverlayForTool } from '@/components/game/overlays';
import { OverlayModeToggle } from '@/components/game/OverlayModeToggle';
import { Sidebar } from '@/components/game/Sidebar';
import {
  BudgetPanel,
  StatisticsPanel,
  SettingsPanel,
  AdvisorsPanel,
} from '@/components/game/panels';
import { MiniMap } from '@/components/game/MiniMap';
import { TopBar, StatsPanel } from '@/components/game/TopBar';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';

// Import example state for random city feature
import exampleState5 from '@/resources/example_state_5.json';

export default function Game() {
  const { state, setTool, setActivePanel, addMoney, addNotification, setSpeed, loadState, hasExistingGame } = useGame();
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const isInitialMount = useRef(true);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  
  // Random city toast state
  const [showRandomCityToast, setShowRandomCityToast] = useState(false);
  const randomCityToastShownRef = useRef(false);
  const gameStartTimeRef = useRef<number | null>(null);
  
  // Cheat code system
  const {
    triggeredCheat,
    showVinnieDialog,
    setShowVinnieDialog,
    clearTriggeredCheat,
  } = useCheatCodes();
  const initialSelectedToolRef = useRef<Tool | null>(null);
  const previousSelectedToolRef = useRef<Tool | null>(null);
  const hasCapturedInitialTool = useRef(false);
  const currentSelectedToolRef = useRef<Tool>(state.selectedTool);
  
  // Keep currentSelectedToolRef in sync with state
  useEffect(() => {
    currentSelectedToolRef.current = state.selectedTool;
  }, [state.selectedTool]);
  
  // Track the initial selectedTool after localStorage loads (with a small delay to allow state to load)
  useEffect(() => {
    if (!hasCapturedInitialTool.current) {
      // Use a timeout to ensure localStorage state has loaded
      const timeoutId = setTimeout(() => {
        initialSelectedToolRef.current = currentSelectedToolRef.current;
        previousSelectedToolRef.current = currentSelectedToolRef.current;
        hasCapturedInitialTool.current = true;
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []); // Only run once on mount
  
  // Auto-set overlay when selecting utility tools (but not on initial page load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Select tool always resets overlay to none (user is explicitly switching to select)
    if (state.selectedTool === 'select') {
      setTimeout(() => {
        setOverlayMode('none');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
      return;
    }
    
    // Subway tool sets overlay when actively selected (not on page load)
    if (state.selectedTool === 'subway' || state.selectedTool === 'subway_station') {
      setTimeout(() => {
        setOverlayMode('subway');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
      return;
    }
    
    // Don't auto-set overlay until we've captured the initial tool
    if (!hasCapturedInitialTool.current) {
      return;
    }
    
    // Don't auto-set overlay if this matches the initial tool from localStorage
    if (initialSelectedToolRef.current !== null && 
        initialSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Don't auto-set overlay if tool hasn't changed
    if (previousSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Update previous tool reference
    previousSelectedToolRef.current = state.selectedTool;
    
    setTimeout(() => {
      setOverlayMode(getOverlayForTool(state.selectedTool));
    }, 0);
  }, [state.selectedTool]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (overlayMode !== 'none') {
          setOverlayMode('none');
        } else if (state.activePanel !== 'none') {
          setActivePanel('none');
        } else if (selectedTile) {
          setSelectedTile(null);
        } else if (state.selectedTool !== 'select') {
          setTool('select');
        }
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setTool('bulldoze');
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        // Toggle pause/unpause: if paused (speed 0), resume to normal (speed 1)
        // If running, pause (speed 0)
        setSpeed(state.speed === 0 ? 1 : 0);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activePanel, state.selectedTool, state.speed, selectedTile, setActivePanel, setTool, setSpeed, overlayMode]);

  // Handle cheat code triggers
  useEffect(() => {
    if (!triggeredCheat) return;

    switch (triggeredCheat.type) {
      case 'konami':
        addMoney(triggeredCheat.amount);
        addNotification(
          'Retro Cheat Activated!',
          'Your accountants are confused but not complaining. You received $50,000!',
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'motherlode':
        addMoney(triggeredCheat.amount);
        addNotification(
          'Motherlode!',
          'Your treasury just got a lot heavier. You received $1,000,000!',
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'vinnie':
        // Vinnie dialog is handled by VinnieDialog component
        clearTriggeredCheat();
        break;
    }
  }, [triggeredCheat, addMoney, addNotification, clearTriggeredCheat]);
  
  // Random city toast - show after 30 seconds if user hasn't placed 10+ tiles
  useEffect(() => {
    // Don't show if already shown or dismissed
    if (randomCityToastShownRef.current) return;
    
    // Don't show if user loaded an existing game (they're continuing a city)
    if (hasExistingGame) {
      randomCityToastShownRef.current = true;
      return;
    }
    
    // Start tracking time when the game component mounts
    if (gameStartTimeRef.current === null) {
      gameStartTimeRef.current = Date.now();
    }
    
    // Count user-placed tiles (non-grass, non-water, non-empty tiles)
    const countPlacedTiles = () => {
      let count = 0;
      for (const row of state.grid) {
        for (const tile of row) {
          const type = tile.building.type;
          // Count anything that's not natural terrain
          if (type !== 'grass' && type !== 'water' && type !== 'empty') {
            count++;
          }
        }
      }
      return count;
    };
    
    const checkAndShowToast = () => {
      if (randomCityToastShownRef.current) return;
      
      const elapsedSeconds = (Date.now() - (gameStartTimeRef.current || Date.now())) / 1000;
      
      // Only check after 30 seconds
      if (elapsedSeconds >= 30) {
        const placedTiles = countPlacedTiles();
        if (placedTiles < 10) {
          setShowRandomCityToast(true);
          randomCityToastShownRef.current = true;
        } else {
          // User has placed enough tiles, no need to show toast
          randomCityToastShownRef.current = true;
        }
      }
    };
    
    // Check every second
    const interval = setInterval(checkAndShowToast, 1000);
    
    return () => clearInterval(interval);
  }, [state.grid, hasExistingGame]);
  
  // Handle loading random city
  const handleLoadRandomCity = useCallback(() => {
    loadState(JSON.stringify(exampleState5));
    setShowRandomCityToast(false);
  }, [loadState]);

  // Mobile layout
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-background flex flex-col">
          {/* Mobile Top Bar */}
          <MobileTopBar 
            selectedTile={selectedTile && state.selectedTool === 'select' ? state.grid[selectedTile.y][selectedTile.x] : null}
            services={state.services}
            onCloseTile={() => setSelectedTile(null)}
          />
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={{ paddingTop: '72px', paddingBottom: '76px' }}>
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              isMobile={true}
            />
          </div>
          
          {/* Mobile Bottom Toolbar */}
          <MobileToolbar 
            onOpenPanel={(panel) => setActivePanel(panel)}
            overlayMode={overlayMode}
            setOverlayMode={setOverlayMode}
          />
          
          {/* Panels - render as fullscreen modals on mobile */}
          {state.activePanel === 'budget' && <BudgetPanel />}
          {state.activePanel === 'statistics' && <StatisticsPanel />}
          {state.activePanel === 'advisors' && <AdvisorsPanel />}
          {state.activePanel === 'settings' && <SettingsPanel />}
          
          <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
          
          {showRandomCityToast && (
            <Toast
              message="Try random city?"
              actionLabel="Load City"
              onAction={handleLoadRandomCity}
              onDismiss={() => setShowRandomCityToast(false)}
            />
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Desktop layout
  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-[720px] overflow-hidden bg-background flex">
        <Sidebar />
        
        <div className="flex-1 flex flex-col">
          <TopBar />
          <StatsPanel />
          <div className="flex-1 relative overflow-visible">
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
              onViewportChange={setViewport}
            />
            <OverlayModeToggle overlayMode={overlayMode} setOverlayMode={setOverlayMode} />
            <MiniMap onNavigate={(x, y) => setNavigationTarget({ x, y })} viewport={viewport} />
          </div>
        </div>
        
        {state.activePanel === 'budget' && <BudgetPanel />}
        {state.activePanel === 'statistics' && <StatisticsPanel />}
        {state.activePanel === 'advisors' && <AdvisorsPanel />}
        {state.activePanel === 'settings' && <SettingsPanel />}
        
        <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
        <CommandMenu />
        
        {showRandomCityToast && (
          <Toast
            message="Try random city?"
            actionLabel="Load City"
            onAction={handleLoadRandomCity}
            onDismiss={() => setShowRandomCityToast(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
