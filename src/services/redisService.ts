import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';

import tomcat from "@gostarehnegar/tomcat";
tomcat.Infrastructure.Base.Logger.level = 'debug'


export type redisInfo = {
    dataDrirectory: string,
    portNumber: string,
    containerID: string,
}

export class RedisService implements tomcat.Infrastructure.Mesh.IMeshService {
    public process: ChildProcessWithoutNullStreams;
    public containerName: string;
    public portNumber: string;
    public dataDirectory: string;
    public containerId: string;
    public isReady: boolean
    public status: tomcat.Infrastructure.Mesh.ServiceStatus = 'start'
    public Id: string = tomcat.utils.UUID()
    constructor(public def: tomcat.Infrastructure.Mesh.ServiceDefinition) {
        this.containerName = (this.def.parameters && this.def.parameters["name"]) as string || tomcat.utils.randomName("redis")
        this.portNumber = this.def.parameters && this.def["port"] as string
        this.dataDirectory = (this.def.parameters && this.def["dataPath"]) || `/home/paria/Desktop/a/${this.containerName}`
    }
    getInformation(): tomcat.Infrastructure.Mesh.ServiceInformation {
        return { category: "redis" as tomcat.Infrastructure.Mesh.ServiceCategories, parameters: { port: this.portNumber, dataDir: this.dataDirectory, containerID: this.containerId, redisName: this.containerName, connectionString: `redis://localhost:${this.portNumber}` }, status: this.status }
    }
    async start(): Promise<unknown> {
        try {
            await this.createDir(this.dataDirectory);
        } catch (err) {
            if (!err.message.includes('exist')) {
                throw err
            }
        }
        this.portNumber = this.portNumber || (await tomcat.utils.findPort(6300, 6378)).toString()
        return new Promise((resolve, reject) => {
            this.process = spawn("docker", ["run", "-d", "-p", `${this.portNumber}:6379`, "-v", `${this.dataDirectory}:/data`, "--name", this.containerName, "redis"])
            this.process.stdout.on('data', (data) => {
                this.containerId = (data.toString() as string).split("\n")[0]
                const result: redisInfo = { containerID: this.containerId, dataDrirectory: this.dataDirectory, portNumber: this.portNumber }
                this.isReady = true
                resolve(result)
            });
            this.process.stderr.on('data', (err) => {
                reject(err.toString())
            });
        })
    }
    createDir(path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(`mkdir ${path}`, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve("done")
                }
            })
        })
    }
}

(async () => {
    const client1 = tomcat.getHostBuilder('redisservice')
        .addMessageBus(cfg => {
            cfg.endpoint = "redisservice";
            cfg.transports.websocket.url = "http://localhost:8082/hub";
        })
        .addMeshService({ category: 'redis', parameters: {} }, (def) => new RedisService(def))
        .build();
    client1.bus.subscribe(tomcat.Domain.Contracts.queryRedisContainer(null).topic, async (ctx) => {
        const meshNode = client1.services.getService<tomcat.Infrastructure.Mesh.MeshNode>(tomcat.constants.Infrastructure.ServiceNames.MeshNode)
        const payload = ctx.message.cast<tomcat.Domain.Contracts.queryRedisContainerPayload>()
        const service = (meshNode.runningServices as RedisService[]).find(x => x.containerName == payload.containerName)
        if (service && service.isReady) {
            await ctx.reply({ connectionString: `redis://localhost:${service.portNumber}` })
        }
    })
    await client1.start()
    await tomcat.utils.delay(15000);
})()