import { MessageBus } from "@gostarehnegar/tomcat/build/main/infrastructure/bus/MessageBus";


declare module '@gostarehnegar/tomcat/build/main/infrastructure/bus/IMessageBus' {
    interface IMessageBus {
        foo(): string;
    }
    
}
declare module '@gostarehnegar/tomcat/build/main/infrastructure/bus/MessageBus' {
    interface MessageBus {
        foo(): string;
    }
}
MessageBus.prototype.foo = function (): string {
    return "hi"
};
