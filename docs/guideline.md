# Arduino Programming Guidelines

## 1. Main Objective

Write Arduino firmware that is simple, readable, reliable, and easy to maintain.

The code must be understandable by a secondary school student who has basic knowledge of Arduino programming.

**Readability and maintainability are more important than writing short or clever code.**

However, simplification must never compromise functionality, hardware compatibility, performance, timing, communication, or safety.

These guidelines apply to all Arduino firmware projects unless explicitly instructed otherwise.

**Communication and Explanation Guidelines**

1. Use simple English and layman's terms that most people can understand.
2. Avoid unnecessary technical jargon, complicated terminology, and unexplained abbreviations.
3. When technical terms are necessary, explain their meaning using simple words.
4. Explain technical problems, proposed solutions, code changes, and testing instructions in a clear, step-by-step manner.
5. Assume the reader has basic Arduino knowledge but limited experience with advanced programming.
6. Keep explanations short, direct, and practical without sacrificing technical accuracy.
7. Apply these rules to all communication, including code comments, debugging explanations, implementation summaries, and final reports.

## 2. Programming Language

1. Use standard Arduino programming syntax and conventions.
2. Follow the official Arduino programming style where applicable.
3. Prefer built-in Arduino functions such as `pinMode()`, `digitalRead()`, `digitalWrite()`, `analogRead()`, `millis()`, and `Serial.print()`.
4. Avoid advanced C++ programming techniques unless technically required.
5. Avoid unnecessary classes, templates, pointers, macros, and complex abstractions.
6. Use standard Arduino libraries when suitable.
7. Do not replace necessary hardware functionality with simpler code that does not meet the requirements.
8. Use board-specific features only when necessary and supported by the selected hardware.
9. Preserve library-required programming structures and interfaces.

**Note:** Arduino uses C++ internally. The objective is beginner-friendly Arduino-style programming rather than advanced C++ programming patterns.

## 3. Code Readability

1. Use simple English for all names and comments.
2. Use descriptive variable names such as `batteryVoltage` instead of `bv`.
3. Use descriptive function names such as `readBatteryVoltage()` instead of `readBV()`.
4. Prefer camelCase naming.
5. Use consistent indentation and spacing.
6. Keep statements short and easy to follow.
7. Avoid deeply nested `if` statements.
8. Avoid combining multiple complicated operations into one line.
9. Use named constants instead of unexplained numbers.
10. Avoid unnecessary abbreviations.
11. Expand compressed statements when doing so improves readability.
12. Prefer straightforward logic over clever programming techniques.
13. Keep related operations together so the program is easy to follow.

## 4. Code Structure

1. Start with a single `.ino` file whenever practical for a new Arduino project.
2. Existing PlatformIO projects may retain their `.cpp` files and established structure.
3. Use `setup()` for initialization.
4. Use `loop()` for normal program execution.
5. Divide different operations into small functions.
6. Each function should have one clear responsibility.
7. Organize functions in a logical sequence.
8. Split code into multiple files only when necessary.
9. Avoid unnecessary project architecture or file structures.
10. Preserve existing shared files when they prevent unnecessary code duplication.
11. Do not restructure working projects solely to make them resemble simple Arduino examples.
12. Keep existing build configurations and source filters unless changes are explicitly required.

## 5. Comments and Explanations

1. Write comments in simple English.
2. Explain the purpose of important functions.
3. Explain complicated logic using short comments.
4. Explain important calculations and their units.
5. Avoid excessive or obvious comments.
6. Comments must match the actual code behavior.
7. Explain necessary hardware-specific operations.
8. Explain advanced programming techniques that cannot safely be removed.
9. A student should understand the program without needing to research advanced programming concepts wherever practical.

## 6. Program Flow

1. Make the program execution sequence easy to follow.
2. Prefer straightforward `if`, `else`, `for`, and `while` statements.
3. Avoid complex nested conditions when simpler logic is possible.
4. Prefer clear functions over large blocks of code.
5. Use `millis()` for non-blocking timing when required.
6. Use `delay()` only when blocking execution is acceptable.
7. Avoid unnecessary multitasking, interrupts, or complex scheduling.
8. Use advanced techniques only when required for correct operation.
9. Preserve existing scheduling behavior and timing requirements.
10. Use rollover-safe timing calculations where required.
11. Retain necessary workers, queues, mutexes, and synchronization mechanisms when removing them could affect functionality or safety.
12. Explain necessary concurrency in simple English.

## 7. Libraries and Dependencies

1. Prefer official Arduino libraries or established compatible libraries.
2. Use only libraries required by the project.
3. Avoid introducing unnecessary dependencies.
4. Clearly identify any additional libraries that must be installed.
5. Verify library compatibility with the selected board.
6. Do not assume a library function exists without verification.
7. Preserve library-required inheritance, interfaces, and macros.
8. Retain necessary Arduino `Stream` and communication client subclasses.
9. Do not replace working libraries without a clear technical reason and approval.
10. Preserve existing board-specific library configurations unless changes are required.

## 8. Error Handling and Debugging

1. Use simple and understandable error-handling logic.
2. Display useful debugging messages through Serial Monitor when appropriate.
3. Explain errors in plain English.
4. Avoid unnecessary debugging frameworks.
5. Check important initialization results.
6. Handle communication failures and invalid inputs where relevant.
7. Never silently ignore important errors.
8. Preserve existing command validation and communication timeouts.
9. Preserve configuration validation and error recovery.
10. Preserve output confirmation and safe-state recovery behavior.
11. Never remove an existing safety mechanism merely to simplify code.
12. Ensure debugging operations do not interfere with required timing or functionality.

## 9. Code Modification Rules

1. Read the existing code before making changes.
2. Understand the current functionality.
3. Modify only the necessary sections.
4. Do not rewrite unrelated working code.
5. Do not introduce new features without approval.
6. Preserve existing behavior unless changes are explicitly requested.
7. Explain what was changed and why.
8. Keep modifications simple and easy to review.
9. Avoid large-scale refactoring solely to improve readability.
10. Prefer small, incremental improvements.
11. Preserve existing uncommitted changes.
12. Do not overwrite or discard unrelated user modifications.
13. Preserve existing hardware pin mappings.
14. Preserve configuration formats and data structures used by other components.
15. Preserve communication protocols, radio messages, MQTT messages, and other external interfaces.
16. Preserve timing limits, scheduling behavior, and operating modes.
17. Preserve output protection, confirmation, and safety behavior.
18. Do not enable additional hardware outputs without approval.
19. Do not introduce unnecessary abstractions or project restructuring.
20. Do not create separate design documents, implementation plans, or guideline alignment documents unless explicitly requested.
21. Use this programming guideline as the single source of truth for general Arduino coding standards.
22. Ask for confirmation before making changes that could significantly affect functionality, compatibility, performance, or safety.

**Project Directory and Library Restrictions**

1. Use `C:\Users\nazur.syahmi\ioscout\src\ios_core\v2.0.0\lib` as the designated directory for all project-specific libraries. The current project baseline is `C:\Users\nazur.syahmi\ioscout\src\ios_core\v2.0.0`.
2. Do not create or add any new files or folders directly under `C:\Users\nazur.syahmi\ioscout\src\ios_core\v2.0.0` unless explicitly requested or approved by the user.
3. Modify existing project files only when necessary to fulfill the requested functionality.
4. Do not create additional source files, libraries, configuration files, or documentation without explicit approval.
5. If implementation requires new files outside the designated library directory, explain the reason and request approval before proceeding.
6. Preserve the existing project directory structure unless explicitly instructed otherwise.

### Hardware Pin Definition Rules

1. Use `C:\Users\nazur.syahmi\ioscout\src\ios_core\v2.0.0\lib\Pins.h` as the central file for hardware pin definitions.
2. Define hardware GPIO pin assignments in `Pins.h` instead of repeating pin numbers across different source files.
3. Reuse existing pin definitions from `Pins.h` whenever possible.
4. Do not create duplicate pin definitions in other files.
5. Preserve existing pin names, pin assignments, and hardware mappings unless changes are explicitly requested.
6. When adding new hardware that requires GPIO pins, update `Pins.h` rather than defining the pins directly in the application code.
7. Do not change existing pin assignments without user approval.
8. Keep pin definitions simple, descriptive, and easy to understand.
9. Preserve any library-required or board-specific pin definitions that must remain in other files for compatibility.
10. Before modifying `Pins.h`, review its existing definitions and check for pin conflicts or unintended hardware changes.

### Build and Automation Directory Rules

1. Use `C:\Users\nazur.syahmi\ioscout\build` as the designated directory for all project build and automation scripts.
2. Review and reuse existing automation scripts before proposing new ones.
3. Do not create duplicate scripts when existing scripts can perform the required operations.
4. Do not create, modify, rename, or delete automation scripts without explicit user approval.
5. Preserve existing automation functionality, configurations, and workflows.
6. Keep automation scripts separate from firmware source files.
7. Do not automatically execute scripts, compile firmware, upload firmware, or run tests without explicit user permission.
8. When automation is requested, use existing scripts whenever practical and report any limitations or required changes.

## 10. Code Validation

1. Review code syntax and logic without automatically compiling or executing firmware. The user will perform compilation and provide the results.
2. Verify that the code follows the selected board's capabilities using available documentation and source code.
3. Check the program logic.
4. Check variable types and calculation units.
5. Identify possible blocking operations.
6. Clearly distinguish between compiled, tested, and unverified code.
7. Never claim hardware functionality has been verified without actual testing.
8. Review existing build configurations and available test results before significant modifications whenever practical.
9. Do not automatically compile firmware. The user will manually compile all affected firmware environments and provide the compilation results.
10. Review relevant existing tests without executing them. The user will perform testing and provide the results unless explicitly requesting Codex to run specific tests.
11. Review configuration parsing, startup behavior, communication protocols, and timing logic where applicable.
12. Review code differences for unintended behavior changes.
13. Identify possible pre-existing issues separately from issues introduced by modifications.
14. Report known failures, potential issues, and unverified functionality.
15. Do not claim that successful compilation proves correct hardware operation.

## 11. Restrictions

Avoid the following unless technically necessary:

- Advanced object-oriented programming
- Complex C++ templates
- Unnecessary pointers and dynamic memory allocation
- Complicated macros
- Excessive preprocessor directives
- Unnecessary third-party frameworks
- Clever one-line programming tricks
- Unexplained bitwise operations
- Unnecessary global variables
- Unnecessary multitasking or concurrency
- Unnecessary project restructuring
- Unnecessary documentation files
- Overengineering

If an advanced technique is necessary, explain its purpose in simple English.

Do not remove technically necessary features merely to satisfy these restrictions.

## 12. Instructions for Codex

Before writing, modifying, or debugging any Arduino code:

1. Read this entire programming guideline.
2. Review the existing project files.
3. Understand the requested functionality.
4. Identify the minimum changes required.
5. Follow the simplest implementation that meets the requirements.
6. Maintain readable, beginner-friendly code.
7. Do not make significant assumptions without confirmation.
8. Preserve existing working functionality and safety behavior.
9. Avoid unnecessary modifications to unrelated files.
10. Review and validate code through inspection without executing firmware unless explicitly requested.
11. Summarize changes in simple English.
12. Clearly identify any advanced techniques that remain necessary.
13. Do not create additional planning or alignment documents unless explicitly requested.
14. Do not require a separate design document approval solely for routine readability improvements.
15. Request approval before significant architectural, functional, hardware, or safety-related changes.
16. Respect any mandatory higher-priority instructions or tool requirements. If they conflict with this guideline, explain the conflict rather than silently bypassing them.

### Manual Compilation, Upload, and Hardware Testing

1. The user is responsible for manually compiling and uploading all firmware to the hardware.
2. Codex must not automatically compile, upload, flash, or execute firmware unless explicitly requested by the user.
3. After modifying the code, Codex must stop and wait for the user to compile and upload it.
4. The user will provide compilation results, Serial Monitor output, hardware measurements, error messages, or other relevant test results.
5. Codex must analyze the results provided by the user before recommending further modifications.
6. If errors occur, identify the likely cause and propose the minimum necessary correction.
7. Do not make multiple speculative changes without sufficient evidence.
8. Fix one issue at a time whenever practical.
9. Do not assume that firmware works correctly until the user confirms the relevant test results.
10. Clearly distinguish between code reviewed, compilation confirmed by the user, firmware uploaded, and hardware functionality verified.
11. After providing code changes, explain what the user should compile, upload, observe, and report.
12. Wait for the user's feedback before proceeding to the next debugging or modification step.

**Final Rule: Codex writes and reviews the code. The user performs compilation, firmware upload, and hardware testing. Codex analyzes the reported results and provides corrections when necessary.**

### Implementation Procedure

When modifying existing firmware:

1. Review the current implementation and available tests.
2. Identify the exact sections requiring modification.
3. Make the smallest practical changes.
4. Preserve existing interfaces, timing, and safety mechanisms.
5. Review the modified code for possible syntax errors and logical issues.
6. Provide instructions for the user to manually compile, upload, and test the firmware.
7. Review the final code for readability and unintended changes.
8. Report the changes and identify anything not yet verified.
9. Wait for the user's compilation and testing feedback before making further modifications.

Do not perform a complete firmware rewrite unless explicitly requested or technically necessary and approved.

### Final Reporting Format

After completing modifications, provide:

**Files Modified**
- List the modified files.

**Changes Made**
- Explain the changes in simple English.

**Validation Results**
- Code review: Completed / Not performed
- Compilation: Passed / Failed / Not performed
- Software tests: Passed / Failed / Not performed
- Firmware upload: Completed / Failed / Not performed
- Hardware tests: Passed / Failed / Not performed

**Remaining Issues**
- Identify any failures, limitations, or unverified behavior.

Do not claim that compilation, uploads, or tests were performed unless the user confirms them or they were explicitly authorized and actually executed.

### External Sources and Internet Access Restrictions

1. Work offline by default using only existing project files, installed libraries, local documentation, and information provided by the user.
2. Do not search, browse, retrieve, or access external internet sources without explicit user permission.
3. Do not access external websites, online documentation, GitHub repositories, forums, APIs, or other online resources without prior approval.
4. Do not download, install, or update libraries, packages, dependencies, or development tools without explicit approval.
5. Reading existing local source code, installed libraries, and locally available documentation is permitted, subject to the VS Code access restrictions below.
6. If external information is required, explain why it is needed, identify the intended source, and request permission before proceeding.
7. Do not assume that unverified technical information is correct. Clearly report it as "Not verified" or "Requires testing".
8. Permission to access one external source does not authorize access to unrelated sources.
9. If permission is denied, continue using available local information where practical and report any verification limitations.
10. Do not automatically perform online research or dependency installation as part of debugging, validation, or code modification.

**Final Rule: External internet access is prohibited by default unless explicitly authorized by the user.**

### Visual Studio Code (VS Code) Access and Control Restrictions

1. Do not automatically open, access, inspect, navigate, or control the user's Visual Studio Code (VS Code) workspace without explicit permission.
2. Do not read, create, modify, rename, move, or delete files through VS Code or other local development tools without explicit user authorization.
3. Do not execute terminal commands, scripts, build tasks, debugging sessions, or other operations within VS Code without explicit permission.
4. Do not automatically open terminals, install extensions, modify settings, change workspace configurations, or interact with development environments without approval.
5. Do not automatically compile, upload, flash, execute, or test firmware through VS Code, PlatformIO, Arduino CLI, or other development tools.
6. Before accessing or modifying the user's workspace, explain the intended action and request approval.
7. Permission to inspect files does not automatically authorize file modifications.
8. Permission to modify specific files does not authorize changes to unrelated files, directories, or configurations.
9. Permission applies only to the explicitly approved action and scope. Additional actions require separate approval.
10. When permission is not granted, provide code, explanations, or proposed changes directly in the conversation without interacting with VS Code.
11. Do not perform background operations, automatic corrections, or workspace changes without explicit authorization.
12. If an operation requires VS Code access or local file modifications, stop and request permission before proceeding.
13. Do not interpret a general request for advice, debugging, code review, or implementation guidance as permission to control VS Code.
14. Do not bypass these restrictions by using alternative tools, terminals, scripts, extensions, or file-access methods.
15. Clearly distinguish between proposed changes, user-approved changes, and changes actually applied.

**Final Rule: Codex must not access, control, or modify the user's VS Code workspace without explicit permission. The user retains control over all workspace operations.**

## 13. Final Readability Test

Before delivering any code, ask:

**"Can a secondary school student with basic Arduino knowledge understand what this code does, follow its execution, and make simple modifications?"**

If the answer is no, simplify the code without compromising required functionality, correctness, performance, timing, communication, or safety.

When advanced techniques are unavoidable, keep them isolated where practical and explain them clearly.

**Final Rule: Write Arduino firmware for humans to understand first, while ensuring the program still works correctly, reliably, and safely.**

## 14. Dashboard Development Guidelines

1. Use simple **Bootstrap, HTML, CSS, and JavaScript** for all dashboard development.
2. Create a modern, clean, and responsive dashboard with **interactive graphical elements, infographics, and icons**, using a red and black color theme with dark mode as the default appearance.
3. Prioritize visual presentation over excessive text.
4. Keep the code simple, readable, and easy to maintain.
5. Use straightforward JavaScript without unnecessary frameworks or complex dependencies.
6. The dashboard must work by **double-clicking `index.html`** to open it directly in a web browser.
7. Do not require a local server, backend, build process, terminal commands, or additional software to run the dashboard.
8. All required CSS, JavaScript, icons, and other assets must be available locally. Do not depend on an internet connection or online CDNs.
9. Use Bootstrap components where appropriate and maintain consistent styling across the dashboard.
10. Ensure interactive elements work correctly when opened using the `file://` protocol.
11. Do not introduce additional features or dependencies without approval.
12. Keep the dashboard structure simple and avoid creating unnecessary files or folders.
13. Display graphical illustrations of hardware operating states, such as valves and motors, where applicable.
14. Valve illustrations must clearly indicate their current state (OPEN or CLOSED).
15. Motor illustrations must clearly indicate their current state (RUNNING or STOPPED).
16. Use visual indicators such as colors, icons, or simple animations to help users understand equipment status at a glance.
17. Graphical illustrations must reflect the actual reported hardware state, not an assumed state.
18. If the hardware state is unavailable or communication is lost, display UNKNOWN or OFFLINE instead of showing an incorrect operating state.
19. Keep illustrations simple, responsive, and compatible with offline dashboard operation.
20. Use a minimum font size of 14px for all dashboard text, including headings, labels, buttons, tables, tooltips, and other interface elements. Do not use font sizes smaller than 14px.
21. Use physical-style graphical visualizations where applicable, such as circular gauges for pressure, thermometers for temperature, tank level indicators, flow meters, turbines, pumps, motors, and valves. These visualizations should resemble recognizable industrial instruments or equipment rather than relying only on text, numbers, or generic icons. Display actual reported measurements and operating states, with clear UNKNOWN or OFFLINE indications when data is unavailable.

**Final Rule: The dashboard must be visually appealing, interactive, beginner-friendly, and fully functional offline by simply double-clicking `index.html`.**

### Visual-First Dashboard Design

1. Prioritize graphical visualization over text-heavy and number-heavy layouts.
2. Use recognizable physical-style illustrations such as gauges, thermometers, tanks, pumps, motors, turbines, valves, batteries, and flow meters wherever applicable.
3. Select visual elements based on the actual measurement type or hardware being monitored.
4. Use simple animations to represent actual operating conditions, such as rotating motors when RUNNING, flowing water when flow is detected, and changing tank levels based on reported measurements. Stop or disable animations when the corresponding equipment is stopped, offline, or its operating state is unknown.
5. Display measurements within or alongside their corresponding graphical instruments.
6. Use clear visual indicators to distinguish NORMAL, WARNING, ALARM, OFFLINE, and UNKNOWN conditions where supported by actual data.
7. Minimize unnecessary text, repetitive labels, and large numerical tables.
8. Ensure users can understand equipment conditions and measurement trends at a glance without reading detailed descriptions.
9. Maintain the red and black theme, with dark mode as the default.
10. Keep all graphical elements responsive, lightweight, and fully functional offline.
11. Do not invent sensor readings, equipment states, alarm thresholds, or animations that imply unverified operating conditions.
12. Preserve all existing dashboard functionality and data accuracy when improving the visual presentation.

### Indicator Colors and Smooth Movement

1. Use **green for OKAY**, **yellow for WARNING**, and **red for DANGER**. Use grey for UNKNOWN or unavailable information.
2. Display a clear indicator legend. Keep status labels readable so users do not have to rely on color alone.
3. Gauge arcs, percentages, and chart values must move smoothly between their old and new values. Do not snap directly to each new value.
4. Retain existing gauge and chart elements during updates. Use animation frames to draw intermediate display values; do not rely only on chart-library transition settings.
5. For the FFM dashboard, refresh demo targets every **1 second** and animate toward each target over **850 ms**. Respect the browser's reduced-motion preference.
6. Keep calculations, tables, and exports based on exact source values. Intermediate animated values are for display only.
7. Cancel previous animations when a new target arrives or when leaving a page. Continue from the currently displayed value when an update interrupts an animation.

### Clearly Labelled Random Demo Data

1. Random fictional data is permitted for the user-approved demonstration. Clearly display **DEMO DATA**, including fictional rates and causes; never present it as operational data.
2. Make changes large enough to see on gauges and charts while keeping the movement smooth. For the current 180-container demo, update up to **54 containers (30%) each second** with wider randomized delivery-status changes.
3. Keep container identities stable between automatic updates. The larger changes demonstrate the interface and do not represent real shipment activity or business rules.
4. Preserve selected filters and calculation settings. Pause automatic changes while a dialog is open, inputs are being edited, or the browser tab is hidden.
5. Never randomize imported operational data or invent missing operational tariffs, causes, dates, or measurements.
