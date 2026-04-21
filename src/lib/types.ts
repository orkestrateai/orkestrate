export type MessageType = 'user' | 'action';

export interface Message {
    id: string;
    type: MessageType;
    content: string;
    icon?: any; // Lucide component
    timestamp: number;
}
