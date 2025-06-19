import * as React from 'react'
import './App.css'
import {Button} from "@/components/ui/button.tsx";
import {Input} from "@/components/ui/input"
import {Badge} from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell, TableHead, TableHeader,
    TableRow,
} from "@/components/ui/table"
import {CountdownTimer} from "@/components/CountdownTimer"
import {cn} from "@/lib/utils.ts";

const servidor = import.meta.env.VITE_SERVIDOR_API;

// Função para extrair o ID do link do Spotify
function pegarIdLinkSpotify(link: string): string {
    if (!link) return "";

    try {
        if (link.includes("open.spotify.com")) {
            const cleanLink = link.split("?")[0];
            return cleanLink.split("/").pop() || "";
        }
        else if (link.startsWith("spotify:")) {
            return link.split(":").pop() || "";
        }

        return link;
    } catch (error) {
        console.error("Erro ao processar o link:", error);
        return "";
    }
}

// Interface para os itens da lista de músicas
interface Musica {
    musica_nome: string;
    status: string;
    id_processo?: string;
    download?: string;
    data_expiracao?: Date;
}

// Interface para a resposta da API de consulta
interface ConsultaResponse {
    id: string;
    musica_nome: string;
    link: string;
    status: string;
    data_gerado: string;
    data_expiracao: string;
}

function App() {
    const [spotifyLink, setSpotifyLink] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [listaMusicas, setListaMusicas] = React.useState<Musica[]>([]);
    const intervalRef = React.useRef<number | null>(null);

    // Função para verificar o status das músicas em processamento
    const verificarStatusMusicas = React.useCallback(async () => {
        const musicasProcessando = listaMusicas.filter(musica =>
            musica.status !== "Concluído" && musica.id_processo
        );

        // Se não houver músicas em processamento, limpa o intervalo
        if (musicasProcessando.length === 0) {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Para cada música em processamento, faz uma requisição para verificar o status
        for (const musica of musicasProcessando) {
            // esperar 3 segundos antes de verificar o status
            await new Promise(resolve => setTimeout(resolve, 3000));

            if (!musica.id_processo) continue;

            try {
                const response = await fetch(`${servidor}/consulta?idPendencia=${musica.id_processo}`);

                if (!response.ok) {
                    console.error(`Erro ao consultar status da música ${musica.musica_nome}`);
                    continue;
                }

                const data: ConsultaResponse = await response.json();

                // Atualiza a lista de músicas com as informações atualizadas
                setListaMusicas(prevLista =>
                    prevLista.map(item => {
                        if (item.id_processo === data.id) {
                            // Converte o status retornado para o formato usado na aplicação
                            const statusFormatado = data.status.toLowerCase() === "concluído" ? "Concluído" :
                                data.status.toLowerCase() === "baixando" ? "Baixando" :
                                    "Processando";

                            // Transforma o link para incluir "/dl/" após o domínio
                            let downloadLink = data.link;
                            if (downloadLink && downloadLink.includes("tmpfiles.org/")) {
                                downloadLink = downloadLink.replace("tmpfiles.org/", "tmpfiles.org/dl/");
                            }

                            return {
                                ...item,
                                musica_nome: data.musica_nome,
                                status: statusFormatado,
                                download: downloadLink,
                                data_expiracao: new Date(data.data_expiracao)
                            };
                        }
                        return {
                            ...item,
                            musica_nome: item.musica_nome,
                            status: item.status,
                            download: item.download,
                        };
                    })
                );
            } catch (error) {
                console.error(`Erro ao consultar status da música:`, error);
            }
        }
    }, [listaMusicas]);

    // Efeito para iniciar ou parar o intervalo de verificação
    React.useEffect(() => {
        // Verifica se há músicas em processamento
        const temMusicasProcessando = listaMusicas.some(musica =>
            musica.status !== "Concluído" && musica.id_processo
        );

        // Se há músicas em processamento e não há intervalo ativo, cria um novo
        if (temMusicasProcessando && intervalRef.current === null) {
            verificarStatusMusicas().then(); // Verifica imediatamente
            intervalRef.current = window.setInterval(verificarStatusMusicas, 3000);
        }
        // Se não há músicas em processamento e há um intervalo ativo, limpa o intervalo
        else if (!temMusicasProcessando && intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Limpa o intervalo quando o componente é desmontado
        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [listaMusicas, verificarStatusMusicas]);

    const handleDownload = async () => {
        const id = pegarIdLinkSpotify(spotifyLink);

        if (!id) {
            return;
        }

        setIsLoading(true);

        try {
            // Fazer a requisição POST com o ID da música
            const response = await fetch(`${servidor}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({id: id}),
            });

            if (!response.ok) {
                throw new Error('Falha ao enviar requisição');
            }

            const data = await response.json();

            // Adicionar a nova música à lista
            setListaMusicas(prevLista => [
                ...prevLista,
                {
                    musica_nome: data.nome_musica,
                    status: "Processando",
                    id_processo: data.id_processo
                }
            ]);

            // Limpar o campo de input após o sucesso
            setSpotifyLink("");
        } catch (error) {
            alert("Erro ao processar a requisição. Verifique o console para mais detalhes.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8 px-4 bg-black text-white">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Formulário de download */}
                <div className="bg-zinc-900 rounded-lg p-4 shadow-sm border border-zinc-800">
                    <h2 className="text-5xl font-semibold mb-4 text-white"
                        style={{fontFamily: "Bungee Spice"}}>SpotDown</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            className="flex-1 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-400 focus-visible:ring-zinc-600"
                            type="text"
                            placeholder="Cole o link da música do Spotify aqui"
                            value={spotifyLink}
                            onChange={(e) => setSpotifyLink(e.target.value)}
                            aria-label="Link da música do Spotify"
                            disabled={isLoading}
                        />
                        <Button
                            variant="default"
                            onClick={handleDownload}
                            disabled={isLoading}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                            aria-busy={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg"
                                         width="24" height="24" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                         strokeLinejoin="round">
                                        <path
                                            d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z"></path>
                                        <path d="M12 13v8"></path>
                                        <path d="M12 3v3"></path>
                                    </svg>
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2" strokeLinecap="round"
                                         strokeLinejoin="round" className="mr-1">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    Baixar
                                </>
                            )}
                        </Button>
                    </div>
                    {spotifyLink && !spotifyLink.includes("spotify.com") && (
                        <p className="text-red-400 text-sm mt-2">
                            Por favor, insira um link válido do Spotify
                        </p>
                    )}
                </div>

                {/* Lista de músicas */}
                <div className="bg-zinc-900 rounded-lg p-4 shadow-sm border border-zinc-800">
                    <h2 className="text-xl font-semibold mb-4 text-white">Suas músicas</h2>

                    {listaMusicas.length === 0 ? (
                        <div className="text-center py-12 text-zinc-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 mb-4 text-zinc-600"
                                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                            </svg>
                            <p className="text-lg text-zinc-300">Nenhuma música baixada ainda</p>
                            <p className="mt-2 text-zinc-400">Cole um link do Spotify acima para começar</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableCaption className="text-zinc-400">Total de
                                    músicas: {listaMusicas.length}</TableCaption>
                                <TableHeader>
                                    <TableRow className="border-zinc-800 hover:bg-zinc-800">
                                        <TableHead className="text-center text-zinc-300">Nome</TableHead>
                                        <TableHead className="text-center text-zinc-300">Status</TableHead>
                                        <TableHead className="text-center text-zinc-300">Expira em</TableHead>
                                        <TableHead className="text-center text-zinc-300">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {listaMusicas.map((musica, index) => (
                                        <TableRow key={musica.id_processo || index}
                                                  className="border-zinc-800 hover:bg-zinc-800">
                                            <TableCell className="font-medium text-white whitespace-normal break-words">{musica.musica_nome}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "px-2 py-1",
                                                        musica.status === "Baixando"
                                                            ? "bg-yellow-900/30 text-yellow-400 border-yellow-800/50"
                                                            : musica.status === "Processando"
                                                                ? "bg-blue-900/30 text-blue-400 border-blue-800/50"
                                                                : "bg-green-900/30 text-green-400 border-green-800/50"
                                                    )}
                                                >
                                                    {musica.status === "Baixando" && (
                                                        <svg className="mr-1 h-3 w-3 animate-spin"
                                                             xmlns="http://www.w3.org/2000/svg" fill="none"
                                                             viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                                                    stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor"
                                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    )}
                                                    {musica.status === "Processando" && (
                                                        <svg className="mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg"
                                                             width="24" height="24" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <path
                                                                d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z"></path>
                                                            <path d="M12 13v8"></path>
                                                            <path d="M12 3v3"></path>
                                                        </svg>
                                                    )}
                                                    {musica.status !== "Baixando" && musica.status !== "Processando" && (
                                                        <svg className="mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg"
                                                             width="24" height="24" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <path d="M20 6 9 17l-5-5"></path>
                                                        </svg>
                                                    )}
                                                    {musica.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {musica.data_expiracao ? (
                                                    <div className="flex flex-col items-center">
                                                        <CountdownTimer targetDate={musica.data_expiracao}/>
                                                        <span className="text-xs text-zinc-400 mt-1">
                                                            {musica.data_expiracao.toLocaleString()}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-500">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {musica.download ? (
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 text-white"
                                                        onClick={() => window.open(musica.download)}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                             strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round" className="mr-1">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                        Baixar
                                                    </Button>
                                                ) : (
                                                    <div role="status" className="flex justify-center">
                                                        <svg aria-hidden="true"
                                                             className="inline w-6 h-6 text-zinc-700 animate-spin fill-green-500"
                                                             viewBox="0 0 100 101" fill="none"
                                                             xmlns="http://www.w3.org/2000/svg">
                                                            <path
                                                                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                                                fill="currentColor"/>
                                                            <path
                                                                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                                                fill="currentFill"/>
                                                        </svg>
                                                        <span className="sr-only">processando...</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App
