export const openCodeMockParts = [
    {
        type: "step-start",
    },
    {
        type: "reasoning",
        text: "The user is asking if I can see what they are building. I'm in plan mode, which means I should only read and inspect files, not make any changes. Let me look at the current directory structure to understand what's being built.\n\nFirst, I should list the files in the current directory to see what we're working with.",
        time: { start: 1768097434966, end: 1768097438378 }
    },
    {
        type: "tool",
        callID: "call_dc1e5e60f8b24488a2cd6f64",
        tool: "bash",
        state: {
            status: "completed",
            input: {
                command: "ls -la",
                description: "List all files in current directory"
            },
            output: "total 96\ndrwxr-xr-x 1 pracu 197609     0 Jan 10 11:34 .\ndrwxr-xr-x 1 pracu 197609     0 Jan  7 19:28 ..\ndrwxr-xr-x 1 pracu 197609     0 Jan  9 16:16 .agent\n-rw-r--r-- 1 pracu 197609  7362 Jan 10 11:36 DESIGN.md\n-rw-r--r-- 1 pracu 197609 33914 Jan 10 11:24 curriculum.js\n-rw-r--r-- 1 pracu 197609 22482 Jan 10 10:57 game.js\n-rw-r--r-- 1 pracu 197609  5543 Jan 10 10:59 index.html\n-rw-r--r-- 1 pracu 197609 11666 Jan 10 10:57 style.css\n"
        }
    },
    {
        type: "step-finish",
        reason: "tool-calls",
        cost: 0,
        tokens: { input: 11077, output: 92, reasoning: 0, cache: { read: 474, write: 0 } }
    },
    {
        type: "step-start",
    },
    {
        type: "text",
        text: "I can see the following files in your project directory:\n- `curriculum.js`\n- `game.js`\n- `DESIGN.md`\n- `index.html`\n- `style.css`\n\nIt looks like you are building a web-based game. How can I help you with it?"
    },
    {
        type: "step-finish",
        reason: "stop",
        cost: 0,
        tokens: { input: 11200, output: 50, reasoning: 0, cache: { read: 500, write: 0 } }
    }
];

export const codexMockItems = [
    {
        type: "session_meta",
        payload: { id: "ses_123", cwd: "/Users/pracu/project", model_provider: "anthropic" }
    },
    {
        type: "response_item",
        payload: {
            type: "reasoning",
            summary: "I need to check the types defined in the project before fixing the function signature.",
            encrypted_content: "Checking type declarations..."
        }
    },
    {
        type: "response_item",
        payload: {
            type: "function_call",
            call_id: "call_abc",
            name: "grep_search",
            arguments: "{\"query\":\"export interface User\",\"path\":\".\"}"
        }
    },
    {
        type: "response_item",
        payload: {
            type: "function_call_output",
            call_id: "call_abc",
            output: "types/user.ts:5:export interface User {\n  id: string;\n  email: string;\n}"
        }
    },
    {
        type: "event_msg",
        payload: { type: "task_complete" }
    },
    {
        type: "response_item",
        payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "I found the `User` interface. It requires an `id` and `email`. I will update the function." }]
        }
    }
];

export const claudeMockLog = [
    {
        uuid: "111",
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "Can you fix the header styling?" }] }
    },
    {
        uuid: "222",
        parentUuid: "111",
        type: "assistant",
        message: {
            role: "assistant",
            content: [
                { type: "thinking", text: "The user wants to fix the header styling. I should find the header component and looking at the styles." },
                {
                    type: "tool_use",
                    id: "toolu_01",
                    name: "ViewCode",
                    input: { path: "src/components/Header.tsx" }
                }
            ]
        }
    },
    {
        uuid: "333",
        parentUuid: "222",
        type: "user",
        message: {
            role: "user",
            content: [
                {
                    type: "tool_result",
                    tool_use_id: "toolu_01",
                    content: "export const Header = () => <header className=\"bg-blue-500 text-white p-4\">My App</header>;"
                }
            ]
        }
    },
    {
        uuid: "444",
        parentUuid: "333",
        type: "assistant",
        message: {
            role: "assistant",
            content: [
                { type: "text", text: "I've checked the `Header` component. It's using Tailwind CSS." },
                {
                    type: "tool_use",
                    id: "toolu_02",
                    name: "EditFile",
                    input: { path: "src/components/Header.tsx", oldStr: "bg-blue-500", newStr: "bg-zinc-900" }
                }
            ]
        }
    }
];
