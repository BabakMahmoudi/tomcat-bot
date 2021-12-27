import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

import tomcat from '@gostarehnegar/tomcat';
import fetch from 'node-fetch';


const proxies = ["CLOUD2.IRSV.ME:8081", "--no-dtls", "--os=win", "--user=ilda", "--passwd-on-stdin", "--servercert", "pin-sha256:RlNF9wT4VvR+O9IiqXxP9PdO+88F6HAZXbFzTjEl3Dk"]

const checkVPN = async (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        fetch("https://youtube.com", { timeout: 10000 })
            .then(res => {
                (res)
                resolve(true)
            })
            .catch((err) => {
                (err)
                reject(false)
            })

    })
}


export class proxy extends tomcat.Infrastructure.Hosting.BackgroundService implements tomcat.Infrastructure.Mesh.IMeshService {
    public process: ChildProcessWithoutNullStreams;
    public bus: tomcat.Infrastructure.Bus.IMessageBus;
    public isAlive: boolean;
    constructor() {
        super();
        this.bus = tomcat.services.getBus()
    }
    getInformation(): tomcat.Infrastructure.Mesh.ServiceInformation {
        return { category: 'proxy', parameters: { connected: this.isAlive } }
    }
    protected async run(token: tomcat.Infrastructure.Base.CancellationToken): Promise<void> {
        while (!token.isCancelled) {
            await tomcat.utils.delay(3 * 1000);
            try {
                await checkVPN()
                console.log("vpn still connected");
                this.isAlive = true
            } catch (err) {
                console.log("vpn disconnected");
                this.isAlive = false
            }
        }
    }
    async start(): Promise<void> {
        this.process = spawn("openconnect", proxies)
        this.process.stdin.write("54652")
        this.process.stdin.end()

        // this.process.stdout.on('data', (data) => {
        //     console.log(data.toString());
        // });
        // this.process.stderr.on('data', (err) => {
        //     console.error(err.toString());
        // });

        await super.start();
    }
    async stop(): Promise<void> {
        super.stop();
    }
}

(async () => {
    const client1 = tomcat.getHostBuilder('proxy')
        .addMessageBus(cfg => {
            cfg.endpoint = "proxy";
            cfg.transports.websocket.url = "http://localhost:8082/hub";
        })
        .addMeshService({ category: 'proxy' as tomcat.Infrastructure.Mesh.ServiceCategories, parameters: {} }, () => new proxy())
        .build();
    // client1.node.startService({ category: 'proxy' as tomcat.Infrastructure.Mesh.ServiceCategories, parameters: {} })
    await client1.start()
    await tomcat.utils.delay(15000);

})()
