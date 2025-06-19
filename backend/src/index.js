import Fastify from 'fastify'
import {
    spotifyParaYoutubeMusic,
    YoutubeMusicParaMp3,
    gerarPendenciaDataBase, consultaPendencia
} from "./funcoes.js"
import cors from '@fastify/cors'

const fastify = Fastify({
    logger: {
        serializers: {
            res(reply) {
                return {
                    statusCode: reply.statusCode,
                };
            },
            req(request) {
                return {
                    method: request.method,
                    url: request.url,
                };
            },
        },
    },
})

fastify.register(cors, {
    origin: '*'
});

fastify.post('/download', async (request, reply) => {
    const {id} = request.body;

    // Verificar se o link do Spotify é válido. Se não for, retornar um erro.
    if (id === undefined || id === '') {
        return reply.code(400).send({
            status: [{sucesso: false, mensagem: 'Link Spotify invalido'}]
        });
    }

    // Converter o link do Spotify para um link do YouTube Music.
    const linkYoutubeMusic = await spotifyParaYoutubeMusic(id);
    if (!linkYoutubeMusic) {
        return reply.code(400).send({
            status: [{sucesso: false, mensagem: 'Musica não encontrada'}]
        });
    }

    // Caso o resultado seja um array, usamos o primeiro elemento.
    const youtubeLink = Array.isArray(linkYoutubeMusic)
        ? String(linkYoutubeMusic[0])
        : String(linkYoutubeMusic);

    const idDownload = await gerarPendenciaDataBase();

    // Processar o link do YouTube Music para conversão para MP3.
    YoutubeMusicParaMp3(youtubeLink, idDownload).then().catch(e => console.log(e));

    return reply.send({id_processo: idDownload, nome_musica: 'Buscando nome...'});
});

fastify.get('/consulta', async (request, reply) => {
    const {idPendencia} = request.query;

    if (!idPendencia) {
        return reply.code(400).send({
            status: [{sucesso: false, mensagem: 'ID do processo nao informado'}]
        });
    }

    const consulta = await consultaPendencia(idPendencia);

    if (!consulta) {
        return reply.code(400).send({
            status: [{sucesso: false, mensagem: 'Processo não encontrado'}]
        });
    }

    return reply.send(consulta);
})

const startServer = async () => {
    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        fastify.log.info(`Servidor rodando em ${fastify.server.address().port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

startServer().then();