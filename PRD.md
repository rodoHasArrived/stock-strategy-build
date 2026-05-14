# Planning Guide

A comprehensive cell-based investment strategy builder that enables users to create, test, and deploy security selection and portfolio construction logic through an intuitive visual and code-based interface supporting AMX market and fundamental data integration.

**Experience Qualities**: 
1. **Professional** - Interface should feel like institutional-grade financial software with precision controls, clear data hierarchy, and confidence-inspiring design
2. **Empowering** - Users transition from visual builder mode to advanced code as their expertise grows, with progressive feature discovery and intelligent defaults
3. **Transparent** - Every calculation, condition, and decision is traceable with data lineage, audit logs, and explainable outputs at the security level

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
- This is a sophisticated investment strategy engine supporting visual builder mode, formula mode, and advanced code mode. It includes sequential cell execution, control flow management (if/next/goto/loop/stop), variable scope tracking, AMX market and fundamental data integration, live previews, validation, data lineage, versioning, backtesting, and explainable security-level decision outputs.

## Essential Features

### Multi-Mode Cell Interface
- **Functionality**: Each cell supports three modes - Visual Builder (drag-and-drop conditions and data field selectors), Formula Mode (Excel-like), and Advanced Code Mode (Python-style)
- **Purpose**: Enable non-technical users to start with visual mode and progressively learn more advanced techniques as they grow
- **Trigger**: User toggles mode selector tabs in cell header (Visual/Formula/Code buttons)
- **Progression**: Select Visual mode → Drag condition blocks → Configure thresholds → Add data field selectors → Preview results → Switch to Formula mode to see generated expression → Switch to Code for full control → Live preview updates in all modes → Generated code syncs across modes
- **Success criteria**: Mode switching preserves intent, visual builder generates valid code, drag-and-drop reordering works smoothly, formula syntax highlighting works, code autocomplete suggests functions and variables, real-time code generation from visual blocks

### Cell Purpose Classification
- **Functionality**: Cells can be tagged by purpose - Universe Definition, Data Retrieval, Calculation, Condition, Ranking, Portfolio Construction, Risk Check, Trade Generation
- **Purpose**: Organize complex strategies with clear visual indication of each cell's role in the workflow
- **Trigger**: User selects purpose from dropdown when creating/editing cell
- **Progression**: Click Add Cell → Select purpose → Cell UI adapts with relevant templates and suggestions → Purpose badge displays on cell → Execution flow diagram highlights cell type
- **Success criteria**: Purpose-specific templates accelerate cell creation, visual flow diagram shows strategy structure at a glance, filtering by purpose works

### AMX Data Integration
- **Functionality**: Direct access to AMX fundamental data (coupon, maturity, rating, sector) and market data (price, yield, spread, duration) via simple function calls
- **Purpose**: Eliminate data integration complexity so users focus on strategy logic rather than data plumbing
- **Trigger**: User types data function in code (PRICE, YIELD, COUPON, DURATION, SPREAD, RATING, SECTOR) or selects field in visual builder
- **Progression**: Type PRICE( → Autocomplete shows available CUSIPs → Select security → Function returns live price → Data refreshes on market updates → Stale data highlighted
- **Success criteria**: Sub-500ms data retrieval, supports 1000+ securities, handles missing data gracefully with null values, shows last update timestamp

### Control Flow & Looping
- **Functionality**: Support for if/else conditionals, next (skip to next cell), goto (jump to cell), loop (iterate), stop (halt execution), and error handling paths
- **Purpose**: Enable complex multi-step strategies with branching logic, iterative processing, and controlled execution flow
- **Trigger**: User writes control flow keywords in code or uses visual flow builder to connect cells
- **Progression**: Cell executes → Evaluates condition → Control flow statement determines next cell → Visual execution path highlights → Jumps to target cell → Loop counter increments → Max iterations prevents infinite loops
- **Success criteria**: if/else branches correctly, goto jumps to specified cell index, loops iterate correctly, max 1000 iterations enforced, stop halts cleanly

### Variable Scope & Live Preview
- **Functionality**: Variables defined in previous cells are accessible in all subsequent cells with live preview of values as you type
- **Purpose**: Build complex multi-step strategies where each cell builds on previous calculations with immediate visual feedback
- **Trigger**: User references variable from earlier cell in current cell code
- **Progression**: Cell 0 defines price = 100 → Cell 1 types price → Autocomplete shows value → Inline preview displays current value → Variable tracking panel updates → All dependent cells marked for recalculation
- **Success criteria**: Variables accessible across cells, live preview shows current values, dependency graph correctly identifies affected cells, context inspector shows complete variable state

### Security Universe & Filtering
- **Functionality**: Define security universes through filters (sector, rating, maturity) and rank/sort based on computed metrics
- **Purpose**: Build portfolios from filtered and ranked security sets matching investment criteria
- **Trigger**: User creates Universe cell and specifies filter conditions
- **Progression**: Select Universe purpose → Add filters (rating >= AA, sector = Financial) → Apply filters to security set → Preview filtered list → Pass universe to next cell → Rank by computed metric
- **Success criteria**: Filters reduce universe correctly, ranking sorts properly, filtered sets pass between cells, preview shows security count and top matches

### Live Backtesting Engine
- **Functionality**: Run strategy against historical AMX data to validate performance and identify edge cases
- **Purpose**: Validate strategy logic before live deployment with detailed trade-level analysis
- **Trigger**: User clicks "Run Backtest" and selects date range
- **Progression**: Click Backtest → Select start/end dates → Engine evaluates conditions against historical snapshots → Display matched trades with entry/exit → Calculate P&L and metrics → Export results to CSV → Identify periods where strategy underperformed
- **Success criteria**: Processes 1 year of daily data in <5 seconds, accurate trade matching, detailed performance attribution, explainable security-level decisions

### Strategy Templates & Gallery
- **Functionality**: Pre-built strategies (carry trade, yield curve steepener, credit spread compression) users can load, preview, and customize
- **Purpose**: Accelerate learning with best-practice examples and provide starting points for common investment approaches
- **Trigger**: User clicks "Templates" button in header
- **Progression**: Click Templates → Gallery opens → Preview strategy → Click Load → Strategy populates → Customize parameters → Save as new
- **Success criteria**: 3+ templates covering major strategies, instant load, clear documentation

### Audit Log & Version History
- **Functionality**: Automatic versioning of strategy changes with complete audit trail
- **Purpose**: Enable rollback to previous versions and maintain compliance audit trail
- **Trigger**: Auto-save on every change, manual "Save Version" for milestones
- **Progression**: Edits auto-save → View history → Preview diff → Restore version → Audit log tracks changes
- **Success criteria**: Zero data loss, clear version diffs, successful restore, immutable audit log

### Data Lineage & Explainability
- **Functionality**: Trace any output value back through complete calculation chain to source data
- **Purpose**: Understand exactly why a security was selected or rejected
- **Trigger**: User clicks "Explain" on cell output or security in results
- **Progression**: Click Explain → Decision tree shows → Trace back to source → View values → Export report
- **Success criteria**: Complete lineage, clear visualization, PDF export, security-level explanations

### Field Picker with Search
- **Functionality**: Searchable dropdown for selecting AMX data fields without memorizing function names
- **Purpose**: Eliminate need to remember exact field names - users can type keywords like "coupon" to find all related fields
- **Trigger**: User clicks field selection dropdown in Visual Builder or Data Field Selector
- **Progression**: Click field dropdown → Type search term (e.g., "coupon") → Results filtered to matching fields (coupon_rate, coupon_frequency, next_coupon_date, accrued_interest) → Click field to select → Field badge shows type (number/text/date/percentage)
- **Success criteria**: Sub-100ms search response, fuzzy matching on field names and descriptions, grouped by category (Identity/Market/Fixed Income/Fundamental/Risk), shows field type and example values

### Formula Autocomplete
- **Functionality**: Context-aware formula suggestions that appear as user types variable assignments
- **Purpose**: Accelerate formula writing and reduce errors by suggesting complete formulas based on variable context
- **Trigger**: User types variable assignment followed by `=` in formula or code mode
- **Progression**: Type "current_yield = " → System detects context → Autocomplete suggestions appear showing multiple formula options (annual_coupon / market_price, face_value * coupon_rate / clean_price, COUPON(cusip) / PRICE(cusip)) → User navigates with ↑↓ keys → Press Enter/Tab to insert suggestion → Formula auto-completes
- **Success criteria**: Suggestions appear within 50ms of typing, arrow key navigation works smoothly, Enter/Tab inserts formula, Esc dismisses, suggestions contextually relevant to variable name, supports common patterns (yields, returns, spreads, durations)

### Python-Style Backtesting Engine
- **Functionality**: Full-featured backtesting environment with pandas-like DataFrame operations, JSON data loading, rolling window calculations, and comprehensive performance metrics (CAGR, Sharpe, Sortino, Calmar, MaxDD)
- **Purpose**: Enable quantitative traders to validate strategies using Python-style syntax with realistic slippage models, transaction costs, and volume constraints before live deployment
- **Trigger**: User clicks Backtest tab in main navigation
- **Progression**: Upload JSON price/volume data → Configure backtest parameters (starting capital, transaction costs, volume cap %, slippage model) → Write Python-style strategy code using DataFrame API (merge, rolling, ffill, pctChange) → Define trading signals (buy/sell/hold with reasons) → Click Run Backtest → View equity curve, trade history, and performance metrics → Export results
- **Success criteria**: Sub-second execution for 250+ day backtests, accurate implementation of adaptive slippage based on ADV, comprehensive metrics dashboard with visual feedback, trade-by-trade breakdown with execution prices, support for dividend reinvestment, realistic partial fill simulation based on volume caps

### Visual Condition Builder
- **Functionality**: Drag-and-drop interface for building complex conditional logic without writing code, now integrated with Field Picker
- **Purpose**: Allow non-technical users to create sophisticated filters and decision rules visually
- **Trigger**: User switches to Visual mode tab in any cell
- **Progression**: Click Add Condition → Click field picker → Search for field (e.g., type "price") → Select from results → Choose operator (>, <, =, between) → Enter value(s) → Add AND/OR logic connectors → Drag to reorder → Real-time code generation displays below → Switch to Code mode to see result
- **Success criteria**: Smooth drag-and-drop, instant code generation, supports nested conditions, clear visual hierarchy, searchable field picker replaces static dropdown, condition blocks show field type badges, between operator supports min/max values

### Data Field Selector
- **Functionality**: Visual interface for selecting which AMX data fields to retrieve and display, organized by category (Market, Fundamental, Identity)
- **Purpose**: Simplify data retrieval by providing a categorized checklist of available fields instead of requiring users to remember function names
- **Trigger**: User scrolls down in Visual mode to Data Fields section
- **Progression**: Browse categories (Market/Fundamental/Identity) → Click field cards to toggle selection → Selected fields highlight with accent ring → Choose aggregation method (sum/avg/max/min/count) → Set sort field and order → Generated code shows field assignments → Execute to retrieve data
- **Success criteria**: Clear category organization, visual selection feedback, supports multiple fields, aggregation options work correctly, sort controls update generated code, field type badges (number/text) display

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
