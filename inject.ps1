$code = @"
using System;
using System.Runtime.InteropServices;

public class ConsoleInjector {
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AttachConsole(uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr GetStdHandle(int nStdHandle);

    [StructLayout(LayoutKind.Sequential)]
    struct COORD {
        public short X;
        public short Y;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct INPUT_RECORD_UNION {
        [FieldOffset(0)] public KEY_EVENT_RECORD KeyEvent;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEY_EVENT_RECORD {
        public bool bKeyDown;
        public ushort wRepeatCount;
        public ushort wVirtualKeyCode;
        public ushort wVirtualScanCode;
        public char UnicodeChar;
        public uint dwControlKeyState;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT_RECORD {
        public ushort EventType;
        public INPUT_RECORD_UNION Event;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool WriteConsoleInput(IntPtr hConsoleInput, ref INPUT_RECORD lpBuffer, uint nLength, out uint lpNumberOfEventsWritten);

    const int STD_INPUT_HANDLE = -10;
    const ushort KEY_EVENT = 0x0001;
    const ushort VK_RETURN = 0x0D;

    public static void SendText(uint pid, string text) {
        FreeConsole(); 
        if (AttachConsole(pid)) {
            IntPtr hStdin = GetStdHandle(STD_INPUT_HANDLE);
            
            foreach (char c in text) {
                INPUT_RECORD irDown = new INPUT_RECORD();
                irDown.EventType = KEY_EVENT;
                irDown.Event.KeyEvent.bKeyDown = true;
                irDown.Event.KeyEvent.wRepeatCount = 1;
                irDown.Event.KeyEvent.UnicodeChar = c;
                uint written;
                WriteConsoleInput(hStdin, ref irDown, 1, out written);

                INPUT_RECORD irUp = new INPUT_RECORD();
                irUp.EventType = KEY_EVENT;
                irUp.Event.KeyEvent.bKeyDown = false;
                irUp.Event.KeyEvent.wRepeatCount = 1;
                irUp.Event.KeyEvent.UnicodeChar = c;
                WriteConsoleInput(hStdin, ref irUp, 1, out written);
            }

            // Send Enter Key
            INPUT_RECORD enterDown = new INPUT_RECORD();
            enterDown.EventType = KEY_EVENT;
            enterDown.Event.KeyEvent.bKeyDown = true;
            enterDown.Event.KeyEvent.wVirtualKeyCode = VK_RETURN;
            enterDown.Event.KeyEvent.UnicodeChar = '\r';
            uint w;
            WriteConsoleInput(hStdin, ref enterDown, 1, out w);

            INPUT_RECORD enterUp = new INPUT_RECORD();
            enterUp.EventType = KEY_EVENT;
            enterUp.Event.KeyEvent.bKeyDown = false;
            enterUp.Event.KeyEvent.wVirtualKeyCode = VK_RETURN;
            enterUp.Event.KeyEvent.UnicodeChar = '\r';
            WriteConsoleInput(hStdin, ref enterUp, 1, out w);

            FreeConsole();
        } else {
            Console.WriteLine("Failed to attach to console of PID " + pid);
        }
    }
}
"@

Add-Type -TypeDefinition $code
[ConsoleInjector]::SendText(38364, "echo it worked > c:\Users\pracu\OneDrive\Desktop\2026\Agentalk\test_out.txt")
