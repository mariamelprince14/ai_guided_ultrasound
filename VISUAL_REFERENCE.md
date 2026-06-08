# USim Redesign - Visual Overview

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIMULATOR HEADER (64px)                       │
│  [Menu] Status [Case#] │ [🟢 BEGINNER ▼] │ [▶] [↺] [⚡] [⚙️]   │
└─────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│  ┌──────────┐                                                      │
│  │ COMPACT  │                    ┌─────────────────────────────┐  │
│  │ SIDEBAR  │                    │  MAIN ULTRASOUND/3D VIEW   │  │
│  │ (260px)  │                    │     (DOMINANT VIEWPORT)    │  │
│  │          │                    │                             │  │
│  │ WORKSPACE│                    │                             │  │
│  │ TRAINING │                    │                             │  │
│  │ SETTINGS │                    │                             │  │
│  │ SUPPORT  │                    │                             │  │
│  │          │                    │                             │  │
│  │ [EXIT]   │                    │                             │  │
│  └──────────┘                    └─────────────────────────────┘  │
│                                   ┌─────────────────────────────┐  │
│                                   │  PROBE CONTROLS (Bottom)    │  │
│                                   └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ METRICS BAR (80px) - Probe Stability │ Coverage │ Contact │ ...  │
└──────────────────────────────────────────────────────────────────┘

FLOATING ELEMENTS:
  - Contextual Guidance (bottom-left)
  - Pressure Gauge (top-right)
  - AI Coaching Panel (bottom-right)
```

## Color Theme

### Background Colors
```
Deep Navy (Primary):     #0a0e27  ████
Light Navy (Secondary):  #131829  ████
Lighter Navy (Tertiary): #1a2847  ████
```

### Text Colors
```
Light Blue (Primary):    #e8f0ff  Text
Med Blue (Secondary):    #a8c5e0  Text
Gray (Tertiary):        #6b8db5  Hint Text
```

### Accent Colors
```
Success Green:  #4ade80  ✓ Optimal
Warning Yellow: #facc15  ⚠ Caution
Danger Red:     #ef4444  ✗ Critical
Info Blue:      #60a5fa  ℹ Information
```

## Component Hierarchy

```
SimulatorLayout (Container)
├── SimulatorHeader
│   ├── Left: Menu + Status
│   ├── Center: Difficulty Selector
│   └── Right: Controls
│
├── CompactSidebar (Overlaid)
│   ├── Logo/Brand
│   ├── Navigation Groups
│   └── Exit Button
│
├── Main Viewport
│   ├── Volume/Ultrasound Viewer
│   └── Probe Controls
│
├── Metrics Bar
│   ├── Metric Cards (Scrollable)
│   ├── Time Display
│   └── Status Badge
│
├── ContextualGuidance (Floating)
├── PressureVisualization (Floating)
└── AICoachingPanel (Floating)
```

## Difficulty Level Visual Indicators

### Beginner (🟢)
- **Icon**: 🟢 Green circle
- **Color**: Soft green glow
- **Interface**: Fully guided
- **Transparency**: High (50%)
- **Guidance**: Maximum
- **Complexity**: Low

### Intermediate (🟡)
- **Icon**: 🟡 Yellow circle
- **Color**: Warm yellow glow
- **Interface**: Moderate guidance
- **Transparency**: Medium (70%)
- **Guidance**: Moderate
- **Complexity**: Medium

### Advanced (🔴)
- **Icon**: 🔴 Red circle
- **Color**: Professional red
- **Interface**: Minimal guidance
- **Transparency**: Low (100%)
- **Guidance**: Critical only
- **Complexity**: High

## Component Interactions

### Difficulty Selector Flow
```
User clicks dropdown
    ↓
Shows 3 options with icons
    ↓
User selects mode
    ↓
UI updates:
  - Viewport transparency changes
  - Guidance overlays adjust
  - Coaching panel visibility toggles
  - Metrics display refreshes
```

### Pressure Gauge Feedback
```
Probe moves in viewport
    ↓
Position triggers pressure calculation
    ↓
Gauge updates:
  - Arc angle changes
  - Color transitions (green→yellow→red)
  - Hint text updates
  - Skin deformation animates
```

### Guidance System Flow
```
Probe at boundary
    ↓
System detects position
    ↓
Generates contextual message:
  - Type: warning
  - Message: "Probe Position Alert"
  - Action: Arrow pointing inward
    ↓
Guidance card slides in
    ↓
User adjusts probe
    ↓
Card auto-dismisses or updates
```

## Responsive Behavior

### Desktop (1200px+)
- Full header with all controls visible
- Sidebar stays collapsed (always accessible)
- All floating elements visible
- Metrics in single horizontal row
- Maximum viewport space

### Tablet (768px-1199px)
- Header collapses less critical controls
- Sidebar available but collapsed by default
- Floating elements reposition
- Metrics scroll horizontally
- Good balance of controls and viewport

### Mobile (<768px)
- Minimal header (icon buttons only)
- Sidebar becomes full-screen overlay
- Floating elements stack vertically
- Metrics in 2-column grid
- Touchable (40x40px) targets
- Maximum viewport focus

## Animation Examples

### Header Difficulty Dropdown
```
Closed: Chevron pointing down ↓
User clicks → Smooth slide down (200ms)
Open: Shows 3 options, chevron rotates ↑
```

### Sidebar Opening
```
Closed: Menu button visible
User clicks → Slide in from left (350ms)
Open: Full sidebar with overlay
User clicks overlay/close → Slide out (200ms)
```

### Contextual Guidance Appearance
```
Hidden: Off-screen, opacity 0
Trigger: Probe at boundary
Action: Slide up + fade in (400ms ease-out)
Display: Float in place, pulse animation
Dismiss: Fade out (200ms ease-out)
```

### Pressure Gauge Update
```
Current pressure: 50%
Probe pressure increases → 65%
Gauge: Arc expands, color transitions from green to yellow
Update: Smooth 300ms ease-out
Hint text: "Weak Contact" → "Optimal Contact"
```

## Interactive Elements

### Buttons & Controls
```
Default State:        Hover State:         Active State:
[Button]         →   [Button Glow]   →   [Button Pressed]
Gray border      →   Light border    →   Dark inset
                      Color accent
```

### Sliders (Scanning Parameters)
```
Track:  ▬▬▬▬▬▬▬▬▬  
Thumb:      ●
Hover:      ●  (Glow effect)
Active:     ●  (Brighter)
Values:     25% | 50% | 75% | 100%
```

### Badges & Indicators
```
Status Badge:
  ● Running (green)
  ⏸ Paused (yellow)
  ✓ Complete (gray)
  Animated pulse when active
```

## Accessibility Features

### Visual Indicators
- ✓ High contrast text (WCAG AAA)
- ✓ Color + icon combination (not color alone)
- ✓ Clear focus indicators (blue outline)
- ✓ Meaningful icon labels

### Keyboard Navigation
- ✓ Tab through all controls
- ✓ Enter/Space to activate buttons
- ✓ Arrow keys for sliders and menus
- ✓ Escape to close overlays

### Screen Reader Support
- ✓ ARIA labels on all buttons
- ✓ Semantic HTML elements
- ✓ Role descriptions
- ✓ Live regions for alerts

## Performance Metrics

### Rendering
- 60fps animations (GPU accelerated)
- Lazy-loaded components (code splitting)
- CSS transforms (no layout thrashing)
- Memoized React components

### Bundle Size
- Simulator theme: ~15KB
- Components: ~45KB
- CSS modules: ~25KB
- Total: ~85KB (gzipped ~20KB)

### Load Time
- Initial paint: <1s
- Interactive: <2s
- All assets: <3s

## Browser Support Matrix

```
                Chrome  Firefox  Safari  Edge   Mobile
Desktop 2020+    ✓       ✓        ✓       ✓      
Tablet 2018+     ✓       ✓        ✓       ✓      ✓
Mobile iOS 12+                    ✓              ✓
Mobile Android 9+ ✓                             ✓
```

## Future UI Enhancements

1. **3D Probe Model**: Real ultrasound probe with texture
2. **Advanced Metrics**: Dashboard with charts and graphs
3. **Voice Control**: Voice-activated guidance and commands
4. **Haptic Feedback**: Simulated haptic responses
5. **Multi-view**: Split-screen with multiple imaging modes
6. **Session Replay**: Video playback of training sessions
7. **Annotations**: Drawing and measurement tools
8. **Virtual Reality**: VR-enabled training mode

