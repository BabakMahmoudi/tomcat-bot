import tomcat from '@gostarehnegar/tomcat';
import { createPublicRedistClient } from '@gostarehnegar/tomcat/build/main/lib/infrastructure/data'
import redis from 'redis'
(createPublicRedistClient);
export class Message {
    private _topic: string;
    private _content: unknown;
    constructor(topic: string, content: unknown) {
        this._topic = topic;
        this._content = content;
    }
    public get Topic() {
        return this._topic;
    }
    public text(): string {
        return this._content as string;
    }
    public content<T>(): T {
        return this._content as T;
    }
}
class MessagePack {
    public id: number;
    public topic: string;
    public content: unknown;
}
export class RedisBus {
    private _client: redis.RedisClient;
    private _publisher: redis.RedisClient;
    private _subscriber: redis.RedisClient;

    constructor() {
    }
    private createRedisClient() {
        return createPublicRedistClient() || redis.createClient(tomcat.config.data.redis.publicUrl);
    }
    private subscriber() {
        return this.createRedisClient();
        this._subscriber = this._subscriber || this.createRedisClient();
        return this._subscriber;

    }
    private publisher() {
        this._publisher = this._publisher || this.createRedisClient();
        return this._publisher;
    }
    private client() {
        this._client = this._client || this.createRedisClient();
        return this._client;

    }
    public healthCheck() {
        this.client().set("babak", "mahmoudi");
        (this.client().connected)

    }
    public subscribe(topic: string, cb: (messag: Message) => void) {
        const subscriber = this.subscriber();
        subscriber.psubscribe(topic, (_err, _count) => {
            if (_err) {
                throw _err
            }
            subscriber.on('pmessage', (_patter, _channel, _content) => {
                var o = JSON.parse(_content) as MessagePack;
                var message = new Message(o.topic, o.content);
                if (cb) {
                    cb(message);
                }
            });
        });

    }
    public publish(topic: string, content: any): void {
        var pack = new MessagePack();
        pack.id = Date.now();
        pack.topic = topic;
        pack.content = content;
        this.publisher().publish(topic, JSON.stringify(pack));
    }

    public static Bus = new RedisBus();

}