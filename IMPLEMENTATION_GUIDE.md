# USim Redesign - Implementation Guide

## Overview

This guide explains the new professional medical ultrasound simulator UI redesign. All components work together to create an immersive, clinical-grade training environment.

## Quick Start

### For Developers

1. **Import the new simulator layout**:
```tsx
import { SimulatorLayout } from '@components/workspace/SimulatorLayout';
```

2. **Use in your page**:
```tsx
<SimulatorLayout
  viewport={<VolumeViewer />}
  controls={<ProbeControls />}
  metrics={<SessionMetricsDisplay />}
/>
```

3. **Import the theme**:
```tsx
import '@styles/simulator-theme.css';
```

### Styling

All components use CSS custom properties from `simulator-theme.css`:

```css
/* Use medical simulator colors */
background-color: var(--sim-bg-primary);
color: var(--sim-text-primary);
border-color: var(--sim-border-light);

/* Use medical accent colors */
background-color: var(--sim-contact-optimal); /* Green */
background-color: var(--sim-contact-weak);    /* Yellow */
background-color: var(--sim-contact-excess);  /* Red */
```

## Component Details

### SimulatorLayout
**Purpose**: Main container for the training workspace  
**Props**: `viewport`, `controls`, `metrics`  
**Location**: Replaces old `WorkspaceLayout`

```tsx
<SimulatorLayout
  viewport={centerPanel}
  controls={probeControls}
  metrics={metricsDisplay}
/>
```

**Features**:
- Includes SimulatorHeader automatically
- Includes CompactSidebar automatically
- Includes floating UI (ContextualGuidance, PressureVisualization, AICoachingPanel)
- Fully responsive layout

### SimulatorHeader
**Purpose**: Professional top control panel  
**Features**:
- Difficulty level selector (Beginner/Intermediate/Advanced)
- Session status badge
- Play/pause, reset, parameters controls
- Scanning parameters floating panel

**Usage**:
The header is included in SimulatorLayout automatically. To customize, modify the component directly.

### CompactSidebar
**Purpose**: Minimal navigation sidebar  
**Props**: `isOpen`, `onClose`  
**Features**:
- Icon-first navigation
- Expandable menu groups
- Mobile overlay support
- Smooth animations

**Usage**:
The sidebar is included in SimulatorLayout automatically. Toggle is managed by SimulatorHeader.

### ContextualGuidance
**Purpose**: Replace confusing labels with intelligent coaching  
**Displays**:
- Real-time contextual guidance
- Educational suggestions with arrows
- Warning/success/info messages
- Auto-positioned (bottom-left)

**State Integration**:
Uses `useAppStore()`:
- `visualizationSettings.showGuidance` - Enable/disable
- `visualizationSettings.mode` - Adjust guidance intensity
- `currentFeedback` - Display current feedback
- `probePosition` - Generate positional guidance
- `volumeInfo` - Boundary awareness

### PressureVisualization
**Purpose**: Real-time contact feedback  
**Displays**:
- Circular pressure gauge (0-100%)
- Contact quality indicator
- Skin deformation animation
- Helpful hints (green/yellow/red)

**State Integration**:
Uses `useAppStore()`:
- `probePosition` - Update pressure simulation

**Color Coding**:
- 🟢 Optimal (80%+) - Green
- 🟡 Weak (40-79%) - Yellow
- 🔴 Excess (80%+) - Red
- ⚪ Poor (<20%) - Gray

### AICoachingPanel
**Purpose**: Live AI coaching assistant  
**Features**:
- Message history with icons
- Type-coded messages (tip/correction/praise/explanation)
- Text-to-speech integration
- Quick tips section
- Collapsible interface
- Hidden in advanced mode

**Message Types**:
- 📚 Tip (informational)
- ⚡ Correction (error feedback)
- ✨ Praise (positive reinforcement)
- 📖 Explanation (educational)
- 🎯 Objective (task guidance)

### ContextualGuidance
**Purpose**: Educational overlays replacing technical labels  
**Auto-displays**:
- Probe position warnings
- Boundary alerts
- Anatomical hints
- Action recommendations
- Success/failure feedback

**Examples of Guidance**:
- "Rotate slightly clockwise"
- "Apply gentle pressure"
- "Move probe lower"
- "Kidney partially visible"
- "Excellent contact"
- "Angle too steep"

### SessionMetricsDisplay
**Purpose**: Real-time performance metrics  
**Metrics Shown**:
- Probe Stability (0-100%)
- Scan Coverage (0-100%)
- Contact Quality (0-100%)
- Scan Efficiency (0-100%)
- Organ Acquisition (0-100%)
- Accuracy Score (0-100%)
- Time Elapsed
- Session Status

**Color Coding**:
- 🟢 Success (80%+)
- 🟡 Warning (60-79%)
- 🔴 Danger (<60%)

## Difficulty Modes

### Beginner (🟢)
**Visual**:
- Semi-transparent torso
- Anatomical structure overlays
- Organ labels
- Probe path guidance
- Beam direction visualization

**Guidance**:
- Maximum AI coaching
- Contextual guidance always active
- Step-by-step instructions
- Collision assistance

**Use Case**: New trainees learning fundamentals

### Intermediate (🟡)
**Visual**:
- Partial transparency
- Some anatomy hints
- Less overlays
- Reduced guidance

**Guidance**:
- Moderate AI coaching
- Contextual guidance when needed
- Feedback-based learning

**Use Case**: Practicing techniques, building efficiency

### Advanced (🔴)
**Visual**:
- Fully opaque realistic body
- No overlays
- Realistic challenges
- Artifacts simulation

**Guidance**:
- Minimal AI coaching
- Critical feedback only
- No coaching panel

**Use Case**: Clinical assessment, professional simulation

## Integration with Existing Code

### App Store (useAppStore)
Already provides all needed state:
- `visualizationSettings` - Difficulty mode
- `probePosition` - Probe location
- `currentFeedback` - AI feedback
- `sessionStatus` - Training state
- `volumeInfo` - Volume boundaries

No changes needed to the store!

### WebSocket Service
Existing methods used:
- `wsService.sendProbeUpdate()` - Send probe position
- `wsService.sendCapture()` - Capture current frame
- `wsService.connect()` - Connect to session
- `wsService.disconnect()` - Disconnect

### Backend Integration Points
The new UI is fully compatible with existing backend:
- Session creation (no changes)
- Probe updates (no changes)
- WebSocket messaging (no changes)
- Volume data loading (no changes)

## Customization Guide

### Change Theme Colors
Edit `src/styles/simulator-theme.css`:

```css
:root {
    --sim-bg-primary: #0a0e27;           /* Change background */
    --sim-text-primary: #e8f0ff;         /* Change text */
    --sim-accent-info: #60a5fa;          /* Change accent */
    --sim-contact-optimal: #4ade80;      /* Change success color */
}
```

### Adjust Component Spacing
```css
:root {
    --sim-spacing-md: 12px;              /* Change base spacing */
    --sim-spacing-lg: 16px;              /* Change large spacing */
}
```

### Modify Animations
```css
:root {
    --sim-transition-fast: 150ms ease-out;
    --sim-transition-normal: 250ms ease-out;
    --sim-transition-slow: 350ms ease-out;
}
```

### Add Difficulty Mode Features

**For Beginner Mode** (enhance transparency):
1. Edit `VolumeViewer.tsx` to check `visualizationSettings.mode`
2. When mode is 'beginner', render additional overlays
3. Use `--sim-surface-primary` with increased opacity

**For Advanced Mode** (disable guidance):
1. Components already check `mode === 'advanced'`
2. Add noise/artifacts to `UltrasoundViewer`
3. Reduce ultrasound beam clarity

## Testing Checklist

- [ ] Header renders correctly on desktop/tablet/mobile
- [ ] Sidebar opens/closes smoothly
- [ ] Difficulty selector updates guidance
- [ ] Pressure visualization updates in real-time
- [ ] Coaching panel shows messages
- [ ] Context guidance appears automatically
- [ ] Metrics display updates
- [ ] All colors visible and readable
- [ ] Animations smooth (60fps)
- [ ] Keyboard navigation works
- [ ] Screen reader announces components
- [ ] Touch targets are 40x40px minimum

## Performance Tips

1. **Memoize components** if they receive frequent updates:
```tsx
const MemoizedGuidance = React.memo(ContextualGuidance);
```

2. **Lazy-load floating components** for mobile:
```tsx
const AICoachingPanel = React.lazy(() => import('./AICoachingPanel'));
```

3. **Use CSS transforms** for animations:
```css
transform: translateY(-10px);  /* GPU accelerated */
```

4. **Limit re-renders** with Zustand selectors:
```tsx
const showGuidance = useAppStore(state => state.visualizationSettings.showGuidance);
```

## Accessibility Features

- All buttons have ARIA labels
- Keyboard navigation fully supported
- High contrast colors (WCAG AAA)
- Focus indicators clearly visible
- Icon buttons include text labels
- Screen reader support built-in
- Text-to-speech in coaching panel

## Known Limitations

1. **Session Control**: Play/pause buttons don't yet control session (ready for backend integration)
2. **Probe Physics**: Pressure values are currently simulated, not from physics engine
3. **3D Probe Model**: Currently using placeholders, real 3D model pending
4. **Artifacts**: Ultrasound artifacts not yet implemented in viewport

## Next Steps

1. Integrate real probe physics simulation
2. Add realistic 3D probe model
3. Implement ultrasound artifact generation
4. Add measurement/annotation tools
5. Create advanced metrics dashboard
6. Implement voice guidance
7. Add session recording/playback

## Support

For issues or questions:
1. Check DESIGN_GUIDE.md for architecture overview
2. Review component source code for implementation details
3. Check theme.css for available CSS variables
4. Review existing components for patterns

