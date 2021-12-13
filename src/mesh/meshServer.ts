import tomcat from '@gostarehnegar/tomcat'


(async () => {

    const port = 8081;
    const hub = tomcat.hosts.getHostBuilder('hub')
        .addWebSocketHub()
        .buildWebHost();
    const server = tomcat.hosts.getHostBuilder('server')
        .addMessageBus(cfg => {
            cfg.endpoint = 'server'
            cfg.transports.websocket.url = `http://localhost:${port}/hub`;
        })
        .addMeshServer()
        .buildWebHost();

    await hub.listen(port);
    await server.start();
})();