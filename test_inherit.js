const { spawn, execSync } = require('child_process');
const fs = require('fs');

// Spawn a simple echo child process that acts like our target (it reads from inherited stdin)
console.log("Starting child...");
const child = spawn('node', ['-e', "console.log('Child ready. Type something.'); process.stdin.on('data', d => { console.log('CHILD HEARD:', d.toString().trim()); if (d.toString().trim() === 'exit') process.exit(0); });"], {
    stdio: 'inherit'
});

setTimeout(() => {
    // Inject text into our OWN console buffer
    console.log("Injecting text via powershell...");
    const psScript = `
\$code = @"
using System;
using System.Runtime.InteropServices;
public class Injector {
    [StructLayout(LayoutKind.Sequential)]
    struct KEY_EVENT_RECORD {
        public bool bKeyDown;
        public ushort wRepeatCount;
        public ushort wVirtualKeyCode;
        public ushort wVirtualScanCode;
        public char UnicodeChar;
        public uint dwControlKeyState;
    }
    [StructLayout(LayoutKind.Explicit)]
    struct INPUT_RECORD_UNION {
        [FieldOffset(0)] public KEY_EVENT_RECORD KeyEvent;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT_RECORD {
        public ushort EventType;
        public INPUT_RECORD_UNION Event;
    }
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr GetStdHandle(int nStdHandle);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool WriteConsoleInput(IntPtr hConsoleInput, ref INPUT_RECORD lpBuffer, uint nLength, out uint lpNumberOfEventsWritten);
    
    public static void SendText(string text) {
        IntPtr hStdin = GetStdHandle(-10); // STD_INPUT_HANDLE
        foreach (char c in text) {
            INPUT_RECORD ir = new INPUT_RECORD();
            ir.EventType = 0x0001;
            ir.Event.KeyEvent.bKeyDown = true;
            ir.Event.KeyEvent.wRepeatCount = 1;
            ir.Event.KeyEvent.UnicodeChar = c;
            uint w; WriteConsoleInput(hStdin, ref ir, 1, out w);
            ir.Event.KeyEvent.bKeyDown = false;
            WriteConsoleInput(hStdin, ref ir, 1, out w);
        }
        // Enter key
        INPUT_RECORD enter = new INPUT_RECORD();
        enter.EventType = 0x0001;
        enter.Event.KeyEvent.bKeyDown = true;
        enter.Event.KeyEvent.wVirtualKeyCode = 0x0D;
        enter.Event.KeyEvent.UnicodeChar = '\\r';
        uint w2; WriteConsoleInput(hStdin, ref enter, 1, out w2);
        enter.Event.KeyEvent.bKeyDown = false;
        WriteConsoleInput(hStdin, ref enter, 1, out w2);
    }
}
"@
Add-Type -TypeDefinition \$code
[Injector]::SendText("hello from node proxy`r")
`;
    
    fs.writeFileSync('inject_self.ps1', psScript);
    execSync('powershell -ExecutionPolicy Bypass -File inject_self.ps1');
}, 2000);

setTimeout(() => {
    execSync('powershell -ExecutionPolicy Bypass -Command "[Injector]::SendText(\'exit`r\')"').toString();
}, 4000);
