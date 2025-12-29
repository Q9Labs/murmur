---
name: mermaid-diagram
description: Generates Mermaid diagrams embedded in styled HTML files. Creates flowcharts, sequence diagrams, architecture diagrams, and other visualizations. Use when asked to create diagrams, visualize workflows, show architecture, generate flowcharts, or create visual representations of systems and processes.
---

# Mermaid Diagram Generator

Generate professional Mermaid diagrams embedded in standalone HTML files that can be opened directly in a browser.

## Instructions

1. Understand what the user wants to visualize (workflow, architecture, sequence, etc.)
2. Choose the appropriate Mermaid diagram type(s)
3. Generate an HTML file with embedded Mermaid diagrams using the template below
4. Save to `docs/` directory with a descriptive filename
5. Open the file in the browser using `open <filepath>`

## Supported Diagram Types

- **flowchart**: Process flows, decision trees, workflows
- **sequenceDiagram**: API calls, message flows, interactions between components
- **graph**: System architecture, component relationships
- **stateDiagram**: State machines, lifecycle diagrams
- **classDiagram**: Object relationships, data models
- **erDiagram**: Database schemas, entity relationships
- **gantt**: Project timelines, schedules

## HTML Template

Use this template structure for all diagram files:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[TITLE]</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 10px;
            font-size: 2.5rem;
        }
        .subtitle {
            color: rgba(255,255,255,0.8);
            text-align: center;
            margin-bottom: 40px;
            font-size: 1.1rem;
        }
        .card {
            background: white;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .card h2 {
            color: #4a5568;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>[MAIN TITLE]</h1>
        <p class="subtitle">[SUBTITLE]</p>

        <div class="card">
            <h2>[SECTION TITLE]</h2>
            <div class="mermaid">
[MERMAID DIAGRAM CODE]
            </div>
        </div>

        <!-- Add more cards for additional diagrams -->

    </div>
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            flowchart: { curve: 'basis' }
        });
    </script>
</body>
</html>
```

## Mermaid Syntax Quick Reference

### Flowchart
```
flowchart TB
    A[Rectangle] --> B(Rounded)
    B --> C{Diamond}
    C -->|Yes| D[Result 1]
    C -->|No| E[Result 2]

    subgraph Group["Group Title"]
        F[Item 1]
        G[Item 2]
    end

    style Group fill:#e8f4f8,stroke:#4a9eba,stroke-width:2px
```

### Sequence Diagram
```
sequenceDiagram
    participant A as Alice
    participant B as Bob

    A->>B: Request
    B-->>A: Response

    loop Every minute
        A->>B: Ping
    end
```

### System Architecture (Graph)
```
graph LR
    subgraph Client["Client Layer"]
        UI[UI Component]
        Service[Service Layer]
    end

    subgraph Server["Server Layer"]
        API[API Gateway]
        DB[(Database)]
    end

    UI --> Service
    Service <-->|HTTP| API
    API --> DB
```

## Styling Tips

- Use `subgraph` to group related components
- Apply colors with `style NodeName fill:#hex,stroke:#hex`
- Use descriptive labels: `A[Clear Label]` not `A[A]`
- Keep diagrams readable - split into multiple if complex

## Example Output

See [template.html](template.html) for a complete working example.
