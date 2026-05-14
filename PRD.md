# Planning Guide

A sophisticated notebook-style code cell execution engine for investment strategies that allows users to create sequential logic flows with control statements (if/next/goto) while maintaining access to market data, parameters, and variables from previous cells.

**Experience Qualities**: 
1. **Professional** - Interface should feel like a serious financial tool with precision controls and clear data hierarchy
2. **Empowering** - Users should feel capable of building complex strategies without coding knowledge through progressive feature discovery
3. **Transparent** - Every calculation and condition should be visible and traceable, building trust in the strategy engine

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
- This is a sophisticated code execution engine requiring sequential cell execution, control flow management (if/next/goto), variable scope tracking across cells, market data integration, and execution state visualization with support for loops and conditional branching.

## Essential Features

### Code Cell Execution Engine
- **Functionality**: Notebook-style sequential code cells that execute in order, each cell can contain logic, calculations, and control flow statements
- **Purpose**: Provides familiar notebook interface for building investment strategies with procedural logic flow and variable passing between cells
- **Trigger**: User clicks "Run" on a cell or "Run All" to execute strategy
- **Progression**: Click Run → Cells execute sequentially (0, 1, 2...) → Variables from previous cells accessible → Control flow (if/next/goto) determines execution path → Output displays in cell → Execution state visualized
- **Success criteria**: Sequential execution works, variables persist across cells, control flow statements redirect execution correctly, no infinite loops

### Control Flow Statements
- **Functionality**: Support for if/else conditionals, next (skip to next cell), goto (jump to specific cell), and loop control
- **Purpose**: Enable complex strategy logic with branching, conditional execution, and iterative processing
- **Trigger**: User writes control flow keyword in cell code (if condition: next, goto cell_5, etc.)
- **Progression**: Cell executes → Evaluates condition → Control flow statement determines next cell → Execution jumps accordingly → Loop detection prevents infinite execution
- **Success criteria**: if/else works correctly, goto jumps to correct cell, next skips current iteration, max 1000 iterations prevent infinite loops

### Variable Scope & Context
- **Functionality**: Variables defined in previous cells are accessible in all subsequent cells, creating execution context
- **Purpose**: Build complex multi-step strategies where each cell builds on previous calculations
- **Trigger**: User references variable from earlier cell in current cell code
- **Progression**: Cell 0 defines price = 100 → Cell 1 references price → Cell 1 can use/modify price → All cells maintain variable state → Execution context shown in sidebar
- **Success criteria**: Variables accessible across cells, scope clear, context inspector shows all variables and values

### Market Data Integration
- **Functionality**: Access to security fundamentals (coupon, maturity, rating) and market data (price, yield, spread)
- **Purpose**: Provide real-time data for strategy calculations like yield-to-maturity, current yield, price-to-carry
- **Trigger**: User references data in formula (e.g., =PRICE("CUSIP123") or =YIELD(A1))
- **Progression**: Type data function → Autocomplete suggests available fields → Select security identifier → Formula returns live value → Updates on data refresh
- **Success criteria**: Data loads within 500ms, supports 100+ securities, handles missing data gracefully

### Strategy Templates & Examples
- **Functionality**: Pre-built strategies (carry trade, yield curve, credit spread) users can load and modify
- **Purpose**: Accelerate learning and provide best-practice starting points
- **Trigger**: User clicks "Load Template" from strategy gallery
- **Progression**: Browse templates → Preview description → Click load → Strategy populates grid → User customizes parameters → Save as new strategy
- **Success criteria**: 5+ templates available, load instantly, clearly documented

### Backtest Simulation
- **Functionality**: Run strategy against historical data to validate performance
- **Purpose**: Validate strategy logic before live deployment
- **Trigger**: User clicks "Run Backtest" button
- **Progression**: Click backtest → Select date range → Engine evaluates conditions against historical data → Display matched trades → Show P&L and metrics → Export results
- **Success criteria**: Processes 1 year of daily data in <3 seconds, accurate trade matching

## Edge Case Handling

- **Circular References**: Detect and highlight cells creating circular dependencies with clear error messaging
- **Missing Data**: Display placeholder values and warning indicators when market data unavailable for referenced securities
- **Invalid Formulas**: Real-time syntax highlighting with helpful error tooltips explaining correction needed
- **Division by Zero**: Catch math errors and display #DIV/0! with contextual explanation
- **Large Datasets**: Virtualize grid rendering to handle 1000+ row strategies without performance degradation
- **Concurrent Edits**: Auto-save strategy state every 10 seconds to prevent data loss

## Design Direction

The design should evoke confidence, precision, and professional-grade capability—like Bloomberg Terminal meets modern SaaS clarity. Users should feel they're working with powerful institutional-grade tools made accessible. The interface should balance data density (critical for financial analysis) with breathing room (essential for complex decision-making). Visual hierarchy must guide users from strategy overview → cell details → data sources without overwhelming.

## Color Selection

A sophisticated financial palette that balances professional credibility with modern approachability—deep navy foundations with vibrant accents for data states.

- **Primary Color**: Deep Navy `oklch(0.25 0.05 250)` - Communicates trust, stability, institutional-grade credibility; used for key actions and navigation
- **Secondary Colors**: 
  - Slate Background `oklch(0.97 0.005 250)` - Neutral foundation that doesn't compete with data
  - Steel Border `oklch(0.85 0.01 250)` - Subtle separation maintaining clean grid structure
- **Accent Color**: Electric Blue `oklch(0.60 0.18 245)` - Attention for active cells, selected formulas, and primary CTAs
- **Data State Colors**:
  - Positive/Gain: Emerald `oklch(0.55 0.15 160)` - Profitable conditions, met thresholds
  - Negative/Loss: Crimson `oklch(0.55 0.20 25)` - Loss conditions, unmet criteria
  - Warning: Amber `oklch(0.70 0.15 75)` - Validation warnings, missing data
- **Foreground/Background Pairings**:
  - Primary Navy `oklch(0.25 0.05 250)`: White text `oklch(1 0 0)` - Ratio 8.2:1 ✓
  - Accent Blue `oklch(0.60 0.18 245)`: White text `oklch(1 0 0)` - Ratio 5.1:1 ✓
  - Slate Background `oklch(0.97 0.005 250)`: Navy text `oklch(0.25 0.05 250)` - Ratio 11.5:1 ✓
  - Emerald `oklch(0.55 0.15 160)`: White text `oklch(1 0 0)` - Ratio 4.8:1 ✓

## Font Selection

Typography should communicate precision and technical sophistication while maintaining excellent readability for dense financial data and formulas.

- **Primary Typeface**: JetBrains Mono for all formula inputs and data cells - monospaced clarity essential for formula alignment and number comparison
- **UI Typeface**: Inter for labels, buttons, and descriptive text - clean, professional, optimized for UI density
- **Typographic Hierarchy**: 
  - H1 (Strategy Title): Inter SemiBold/24px/tight (-0.02em) letter spacing
  - H2 (Section Headers): Inter Medium/18px/normal spacing
  - H3 (Panel Titles): Inter Medium/14px/normal spacing
  - Cell Values: JetBrains Mono Regular/13px/tabular numbers enabled
  - Cell Formulas: JetBrains Mono Regular/13px/syntax-colored
  - Button Labels: Inter Medium/14px/uppercase tracking (0.02em)
  - Body Text: Inter Regular/14px/1.5 line-height
  - Helper Text: Inter Regular/12px/muted color

## Animations

Animations should reinforce calculation flow and data updates without distracting from analytical focus. Subtle, purposeful micro-interactions build confidence in the engine's reactivity.

- **Cell Updates**: When dependent cells recalculate, brief blue glow pulse (200ms) emanates from source cell through dependencies
- **Formula Entry**: Smooth expand animation when clicking cell to edit (150ms elastic ease)
- **Condition Matching**: When condition evaluates true, subtle green border fade-in (300ms) on matching securities
- **Parameter Updates**: Ripple effect (250ms) across all cells referencing the changed parameter
- **Error States**: Gentle shake (300ms) on formula error with error tooltip slide-down
- **Data Loading**: Skeleton shimmer for market data placeholders, smooth fade-in when data arrives
- **Panel Transitions**: Slide-in (250ms) for side panels (parameters, conditions), maintaining spatial context

## Component Selection

- **Components**: 
  - **Table**: Custom virtualized grid component for the cell engine (built with react-virtualized approach, not shadcn Table which is too simple)
  - **Input**: For cell editing with formula autocomplete
  - **Select**: Parameter type selection, data field selection in condition builder
  - **Button**: Primary actions (Run Backtest, Save Strategy), secondary (Add Parameter, Load Template)
  - **Card**: Strategy templates in gallery, parameter groups, condition rule containers
  - **Tabs**: Switch between Strategy Grid, Parameters, Conditions, Backtest Results
  - **Dialog**: Template previews, strategy save/load, confirmation modals
  - **Popover**: Cell reference help, formula function documentation, data field info
  - **Badge**: Cell type indicators (formula/value/parameter), data state (live/stale)
  - **Tooltip**: Hover on cells for full formula/value, error explanations
  - **Separator**: Visual breaks between grid sections and panels
  - **ScrollArea**: For parameter lists, condition builders, template gallery
  - **Sheet**: Slide-out panel for detailed backtest results or data inspector

- **Customizations**: 
  - **Formula Input**: Custom input with syntax highlighting using spans for operators, functions, references
  - **Grid Cell**: Custom component with conditional styling, edit/view states, formula bar integration
  - **Condition Builder**: Custom component with draggable rule groups, visual connection lines between chained conditions
  - **Parameter Panel**: Custom two-column layout with parameter cards showing current value and usage count

- **States**: 
  - **Cells**: Default (white), Active/Editing (blue border glow), Has Formula (subtle blue tint), Error (red border), Calculating (shimmer overlay)
  - **Buttons**: Primary (navy bg → darker on hover → depressed on active), Secondary (outline → filled on hover), Disabled (muted gray)
  - **Inputs**: Resting (border gray), Focused (blue border + subtle shadow), Error (red border + error icon), Valid (green checkmark if validation needed)
  - **Conditions**: Inactive (gray), Evaluating (blue pulse), True (green border), False (red border), Disabled (muted + strikethrough)

- **Icon Selection**: 
  - Plus: Add parameters, conditions, rows/columns
  - Play: Run backtest, execute strategy
  - Pause: Stop calculation
  - FloppyDisk: Save strategy
  - FolderOpen: Load strategy
  - Function: Formula builder
  - ChartLine: View performance metrics
  - Warning: Validation errors, missing data
  - CheckCircle: Condition met, validation success
  - XCircle: Condition failed, error state
  - CaretRight/Down: Expand/collapse sections
  - MagnifyingGlass: Search securities, filter data
  - Sliders: Adjust parameters
  - Table: Grid view toggle

- **Spacing**: 
  - Grid cells: 8px padding, 1px borders
  - Panels: 24px padding, 16px gap between sections
  - Buttons: 12px vertical, 20px horizontal padding
  - Cards: 20px padding, 12px gap between elements
  - Sections: 32px margin between major sections
  - Input groups: 8px gap between label and input

- **Mobile**: 
  - Grid becomes scrollable horizontally and vertically with sticky headers
  - Parameter panel becomes bottom sheet instead of sidebar
  - Condition builder stacks vertically instead of horizontal flow
  - Formula bar moves to full-width sticky bottom input
  - Tabs become horizontal scrollable strip with larger touch targets (min 48px height)
  - Templates gallery becomes single column with larger preview cards
  - Backtest results prioritize key metrics in summary cards before detailed tables
