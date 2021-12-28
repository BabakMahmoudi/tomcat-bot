import tomcat from "@gostarehnegar/tomcat"
import NodeTelegram from 'node-telegram-bot-api'

export class TelegramBot implements tomcat.Infrastructure.Mesh.IMeshService {
    public token = '';
    public client;
    public Id: string = tomcat.utils.UUID()
    public status: tomcat.Infrastructure.Mesh.ServiceStatus = "stop"
    public bus: tomcat.Infrastructure.Bus.IMessageBus
    constructor(def: tomcat.Infrastructure.Mesh.ServiceDefinition, public serviceProvider: tomcat.Infrastructure.Base.IServiceProvider) {
        (def)
        this.client = new NodeTelegram(this.token, { polling: true },);
        this.bus = this.serviceProvider.getBus()
    }
    getInformation(): tomcat.Infrastructure.Mesh.ServiceInformation {
        return { category: 'telegram', parameters: {}, status: this.status }
    }
    start(): Promise<unknown> {
        this.client.onText(/\/start/, (msg) => {
            this.bus.subscribe("loggs/critical", async (ctx) => {
                this.client.sendMessage(msg.chat.id, ctx.message.payload)
            })
            this.client.sendMessage(msg.chat.id,"khob")
        })
        this.status = "start"
        return Promise.resolve()
    }
};
(async () => {
    const host: tomcat.Infrastructure.Hosting.IHost = tomcat.getHostBuilder("TelegramBot")
        .addMessageBus(cfg => {
            cfg.endpoint = "TelegramBot"
            cfg.transports.websocket.url = "http://localhost:8082/hub"
        })
        .addMeshService({ category: "telegram", parameters: {} }, (def) => new TelegramBot(def, host.services))
        .build()
    const a = host.services.getService<tomcat.Infrastructure.Mesh.ServiceDescriptor>(tomcat.constants.Infrastructure.ServiceNames.ServiceDescriptor)
    const serv = a.serviceConstructor({ category: "telegram", parameters: {} })
    await serv.start()
})()
