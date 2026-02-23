$code = @"
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
        enter.Event.KeyEvent.UnicodeChar = '\r';
        uint w2; WriteConsoleInput(hStdin, ref enter, 1, out w2);
        enter.Event.KeyEvent.bKeyDown = false;
        WriteConsoleInput(hStdin, ref enter, 1, out w2);
    }
}
"@
Add-Type -TypeDefinition $code
[Injector]::SendText("it worked! injected magically into my own STDIN")
