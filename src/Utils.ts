import tomcat from '@gostarehnegar/tomcat';
import fs from 'fs';
import path from 'path';
export class Utils {


    public static async WriteText() {
        return fs.writeFileSync("aa.txt", "hello");

    }
    public static ReadConfig<T>(dir: string): T {

        var configFile = path.resolve(dir, 'config.json')
        console.log(configFile);
        var data = fs.existsSync(configFile)
            ? fs.readFileSync(configFile).toString()
            : null;
        if (data) {
            var result = JSON.parse(data) as T;
            Object.assign(tomcat.config, result);
            return result;
        }
        return {} as T;
    }
    public static getStartedTopic(id: string) {
        return `${id}/started`
    }

}