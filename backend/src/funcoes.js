import SpotifyToYoutubeMusic from 'spotify-to-ytmusic';
import youtubeDl from "youtube-dl-exec";
import {tmpdir} from 'os';
import path from 'path';
import * as fs from "node:fs";
import fetch from 'node-fetch';
import FormData from 'form-data';
import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Gera uma pendência no banco de dados, para uso posterior.
 * Retorna o ID gerado.
 * @returns {string|null} - ID da pendência gerada, ou null em caso de erro.
 */
async function gerarPendenciaDataBase() {
    const pendencia = await prisma.musica.create({
        data: {
            link: '',
            musica_nome: 'Buscando nome...',
            status: 'pendente',
            data_gerado: new Date(),
            data_expiracao: new Date()
        }
    });

    if (!pendencia || !pendencia.id) {
        return null;
    }

    return pendencia.id;
}

/**
 * Atualiza a pendência no banco de dados com o status atual e um link
 * (opcional).
 * @param {string} idPendencia - O ID da música no banco de dados.
 * @param {string} status - O status da música, pode ser 'pendente', 'baixando', 'executando upload' ou 'concluído'.
 * @param {string} [link] - O link da música, somente necessário se o status for 'concluído'.
 * @param {string} [nome] - O nome da música, somente necessário se o status for 'concluído'.
 */
async function atualizarPendenciaDataBase(idPendencia, status, link, nome = '') {
    const data = { status };

    if (nome) data.musica_nome = nome;

    if (status === 'concluído') {
        Object.assign(data, {
            link,
            data_gerado: new Date(),
            data_expiracao: new Date(Date.now() + 3600000),
            musica_nome: nome
        });
    }

    await prisma.musica.update({
        where: { id: idPendencia },
        data,
    });
}

async function consultaPendencia(idPendencia) {
    const pendencia = await prisma.musica.findUnique({
        where: {
            id: idPendencia
        },
        select: {
            id: true,
            musica_nome: true,
            link: true,
            status: true,
            data_gerado: true,
            data_expiracao: true
        }
    })

    if (!pendencia) {
        return null;
    }

    return pendencia;
}

/**
 * Converte uma música do Spotify para o YouTube Music.
 * @param {string} idMusicaSpotify - O idMusicaSpotify da música do Spotify.
 */
async function spotifyParaYoutubeMusic(idMusicaSpotify) {
    // Define as credenciais do Spotify
    const spotifyToYoutubeMusic = await SpotifyToYoutubeMusic({
        clientID: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    // Converter uma música do Spotify
    if (idMusicaSpotify) {
        let musicaYTM = await spotifyToYoutubeMusic(idMusicaSpotify);
        return musicaYTM;
    }
    return '';
}

/**
 * Realiza o upload de um arquivo para https://tmpfiles.org/api.
 * @param {string} filePath - Caminho do arquivo a ser enviado.
 * @returns {Promise<Object>} - Resposta da API em formato JSON.
 */
async function uploadToTmpfiles(filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    });

    if (!response.ok) {
        throw new Error(`Upload falhou com status ${response.status}`);
    }

    return await response.json();
}

/**
 * Baixa uma música do YouTube Music, converte para .mp3 e faz o upload para https://tmpfiles.org.
 * A música é salva na pasta temporária do sistema operacional.
 *
 * @param {string} link - O link da música no YouTube.
 * @param {string} idMusica - O ID do processo no banco de dados.
 */
async function YoutubeMusicParaMp3(link, idMusica) {
    await atualizarPendenciaDataBase(idMusica, 'pendente', '');

    const detalhes = await youtubeDl(link, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['referer:youtube.com', 'user-agent:googlebot']
    });
    if (!detalhes) return;

    // Define o caminho de saída na pasta temporária, usando o título do vídeo como nome de arquivo
    const {artist, title} = detalhes;
    const nomeMusica = artist && title ? `${artist} - ${title}` : `${title}`;
    const pastaSalvar = path.join(tmpdir(), nomeMusica + '.mp3');
    await atualizarPendenciaDataBase(idMusica, 'baixando', '', nomeMusica);

    // Se já existir um arquivo com o mesmo nome, ele será apagado
    if (fs.existsSync(pastaSalvar)) {
        fs.unlinkSync(pastaSalvar);
    }

    try {
        const downloadOutput = await youtubeDl(link, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: pastaSalvar,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });

        await atualizarPendenciaDataBase(idMusica, 'executando upload', downloadOutput, nomeMusica);

        // Após o download, realizar o upload da música
        const uploadResponse = await uploadToTmpfiles(pastaSalvar);

        await atualizarPendenciaDataBase(idMusica, 'concluído', uploadResponse.data.url, nomeMusica);
    } catch (error) {
        console.error("Erro no download/conversão ou upload:", error);
    }
}

export {
    spotifyParaYoutubeMusic,
    YoutubeMusicParaMp3,
    gerarPendenciaDataBase,
    consultaPendencia
};