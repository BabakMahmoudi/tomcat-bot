// import { exec } from 'child_process';

// const stopAndRemoveRedis = async (containerId: string) => {
//     return new Promise<string>((resolve, reject) => {
//         exec(`docker rm -f ${containerId}`, (err, std) => {
//             if (err) {
//                 reject(err)

//             } if (std) {
//                 resolve(std)
//             }
//         })
//     })
// }

// (async () => {
//     const res = await waitForRedis();
//     await stopAndRemoveRedis(res as string)
// })()
import { spawn, ChildProcessWithoutNullStreams, exec } from 'child_process';
import port from 'portastic'
const getPort = (min: number, max: number) => {
    return new Promise<number>((resolve, reject) => {
        port.find({ min: min, max: max }, function (data, err) {
            if (err) {
                reject(err)
            }
            resolve(data[1])
        });
    })
}

const createDir = async (path: string) => {
    return new Promise((resolve, reject) => {
        exec(`mkdir ${path}`, (err) => {
            if (err) {
                reject(err)
            }
            resolve("done")
        })
    })
}

export class RedisProcess {
    public processes: ChildProcessWithoutNullStreams;

    async startAsync(port: number, name: string) {
        const volumeDir = `/home/paria/Desktop/a/${name}`
        try {
            await createDir(volumeDir);
        } catch (err) {
            if (!err.message.includes('exist')) {
                throw err
            }
        }
        return new Promise((resolve, reject) => {
            this.processes = spawn("docker", ["run", "-p", `${port}:6379`, "-v", `${volumeDir}:/data`, "redis"])
            this.processes.stdout.on('data', () => {
                resolve(`redis started on port ${port}`)
            });
            this.processes.stderr.on('data', (err) => {
                reject(err)
            });
        })
    }
    async stopAsync() {
        return new Promise((resolve, reject) => {
            const res = this.processes.kill()
            if (res) {
                resolve("redis stoped")
            } else {
                reject("could not stop redis process")
            }
        })
    }
}
(async () => {
    const port = await getPort(6300, 6378);
    const redis = new RedisProcess()
    try {
        const a = await redis.startAsync(port, "babak");
        console.log(a)
    } catch (err) {
        console.log(err);
    }
    setInterval(async () => {
        await redis.stopAsync()
    }, 10000)

})()