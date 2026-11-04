<?php
/**
 * Kenium Music Bot - Configuration & Localization
 * High-performance, modern frontend landing page
 */

session_start();

// Active Language Detection (Default: tr, supported: tr, en, pt)
$supported_langs = ['tr', 'en', 'pt'];
if (isset($_GET['lang']) && in_array(strtolower($_GET['lang']), $supported_langs)) {
    $_SESSION['kenium_lang'] = strtolower($_GET['lang']);
    setcookie('kenium_lang', strtolower($_GET['lang']), time() + (86400 * 30), "/");
} elseif (isset($_COOKIE['kenium_lang']) && in_array(strtolower($_COOKIE['kenium_lang']), $supported_langs)) {
    $_SESSION['kenium_lang'] = strtolower($_COOKIE['kenium_lang']);
}

$current_lang = $_SESSION['kenium_lang'] ?? 'tr';

// Site Metadata & Links
$site_config = [
    'name' => 'Kenium',
    'title' => 'Kenium — Özgür ve Açık Kaynaklı Discord Müzik Botu',
    'version' => 'v2.4.0',
    'bot_invite' => 'https://discord.com/oauth2/authorize?client_id=1202232935311495209&permissions=8&scope=bot%20applications.commands',
    'github_repo' => 'https://github.com/ToddyTheNoobDud/Kenium-Music',
    'support_server' => 'https://discord.com/invite/K4CVv84VBC',
    'video_setup' => 'https://www.youtube.com/watch?v=tSFp2ESLxyU',
    'stats' => [
        'servers' => '1.3k+',
        'memory_per_player' => '~1 MB',
        'sources' => '30+',
        'languages' => '11',
        'price' => '$0',
        'license' => 'MIT'
    ]
];

// Translations Dictionary
$lang_data = [
    'tr' => [
        'nav' => [
            'how' => 'Nasıl Çalışır?',
            'demo' => 'Canlı Sıra Simülatörü',
            'filters' => 'Filtreler & Ses',
            'commands' => 'Komutlar',
            'numbers' => 'Rakamlar',
            'host' => 'Self-Host',
            'faq' => 'S.S.S.',
            'add' => 'Discord\'a Ekle',
            'source' => 'GitHub'
        ],
        'hero' => [
            'badge' => 'Discord İçin Yeni Nesil Müzik Botu',
            'lead' => 'Şarkıyı Çal. Oylamayı Atla.',
            'sub' => 'YouTube, Spotify, SoundCloud ve 30+ platform. Ses kanalında müziği başlat ve gecenin tadını çıkar. Sıfır oy kilidi, premium paket tuzağı yok, tamamen açık kaynak.',
            'free_label' => '%100 Ücretsiz · Premiumsuz · Oy Zorunluluğu Yok',
            'cta_add' => 'Discord\'a Ekle',
            'cta_code' => 'Kaynak Kodunu İncele',
            'pluck_hint' => 'Sesi hissetmek için teli titreşir:',
            'status_online' => 'Tüm Düğümler Aktif & Çevrimiçi',
            'pill_memory' => 'Oynatıcı Başına ~1 MB RAM',
            'pill_free' => '$0 Ömür Boyu Ücretsiz',
            'pill_sources' => '30+ Müzik Kaynağı',
            'pill_uptime' => '24/7 Kesintisiz Ses'
        ],
        'queue_demo' => [
            'kicker' => 'İnteraktif Deneyim',
            'title' => 'Discord Sıra Simülatörü',
            'subtitle' => 'Discord sunucunda Kenium\'un nasıl tepki verdiğini hemen canlı olarak test et.',
            'now_playing' => 'Şu An Çalıyor',
            'up_next' => 'Sıradaki Parçalar',
            'empty' => 'Sıra şu an boş. /play ile yeni bir parça ekle.',
            'loop_off' => 'Tekrar: Kapalı',
            'loop_track' => 'Tekrar: Parça',
            'loop_queue' => 'Tekrar: Sıra',
            'live_note' => 'Örnek simülatör. Ses doğrudan tarayıcında simüle edilmektedir.',
            'reset_btn' => 'Sırayı Sıfırla',
            'actions_title' => 'Simüle Edilen Komutlar',
            'prompt_song' => 'Çalmak istediğin şarkının adını veya linkini yaz:'
        ],
        'journey' => [
            'kicker' => 'Nasıl Çalışır?',
            'title' => 'Bir /play Komutunun Yolculuğu',
            'intro' => 'Kenium\'u sunucuna ekle, ses kanalına katıl ve /play yaz. Tüm kurulum bu kadar.',
            'steps' => [
                [
                    'label' => '1. Sen',
                    'title' => 'Sen /play yazarsın',
                    'body' => 'İster şarkı adı, ister Spotify veya YouTube linki. İki harften sonra akıllı otomatik tamamlama devreye girer.',
                    'badge' => 'Kullanıcı Girdisi'
                ],
                [
                    'label' => '2. Discord',
                    'title' => 'Discord komutu Kenium\'a iletir',
                    'body' => 'Discord botların yanıt vermesi için 3 saniye süre tanır. Kenium anında onaylar ve arkadaki ağır işi başlatır.',
                    'badge' => '< 300ms Yanıt'
                ],
                [
                    'label' => '3. Aqualink',
                    'title' => 'Aqualink en uygun düğümü seçer',
                    'body' => 'Aqualink, ses sunucuları için geliştirdiğimiz yüksek erişilebilirlikli bağlantı katmanıdır. En az yüke sahip Lavalink/Nodelink düğümünü seçer.',
                    'badge' => 'Akıllı Dengeleme'
                ],
                [
                    'label' => '4. Nodelink',
                    'title' => 'Düğüm ağır yükü üstlenir',
                    'body' => 'Kod çözme, filtreler, ses miksajı. Kenium bot çekirdeği sese neredeyse hiç dokunmaz; bu sayede bir oynatıcı yalnızca ~1 MB RAM harcar.',
                    'badge' => '~1 MB RAM'
                ],
                [
                    'label' => '5. Kaynaklar',
                    'title' => 'Şarkını 30+ kaynaktan çeker',
                    'body' => 'YouTube, Spotify, SoundCloud, Deezer, Apple Music, Bandcamp, Twitch veya doğrudan ses dosyaları anında bulunur.',
                    'badge' => '30+ Platform'
                ],
                [
                    'label' => '6. Ses Kanalı',
                    'title' => 'Ses doğrudan kulaklara ulaşır',
                    'body' => 'Hiçbir dosya indirilmez. 384kbps yüksek bit hızında ses akışı doğrudan Discord ses kanalına aktarılır.',
                    'badge' => '384kbps Canlı Akış'
                ]
            ]
        ],
        'rack' => [
            'kicker' => 'Dahili Ses Filtreleri',
            'title' => 'Okumak Yerine Kulak Ver.',
            'body' => 'Bass boost, nightcore, 8D audio, karaoke ve dahası. Discord\'da /filters komutuyla, veya aşağıda tarayıcındaki Web Audio sentetizöründe hemen dene.',
            'start' => 'Sentezleyiciyi Başlat',
            'stop' => 'Durdur',
            'off_status' => 'Duraklatıldı. Başlat butonuna bas.',
            'on_status' => 'Sentezleyici döngüsü çalıyor...',
            'speed' => 'Hız & Perde',
            'modes' => [
                'normal' => 'Normal (Stüdyo)',
                'bass' => 'Bass Boost (Derin Bas)',
                'nightcore' => 'Nightcore (Tiz & Hızlı)',
                'slowed' => 'Slowed + Reverb (Yavaş)',
                'muffled' => 'Boğuk (Duvar Arkası)',
                'echo' => 'Stereo Yankı (8D)'
            ]
        ],
        'commands' => [
            'kicker' => 'Komut Kütüphanesi',
            'title' => 'Tek Bir Eğik Çizgi Yeter.',
            'intro' => '/play ile başla, /search ile alternatifleri gör. 37\'den fazla güçlü komutla sunucunun müziğini tam olarak yönet.',
            'search_placeholder' => 'Komut ara... (örn: /play, loop, filtre, ses)',
            'empty' => 'Aramanıza uygun komut bulunamadı. Başka bir kelime deneyin.',
            'copy_success' => 'Komut panoya kopyalandı!',
            'categories' => [
                'all' => 'Tümü',
                'playback' => 'Oynatma',
                'queue' => 'Sıra',
                'filters' => 'Ses & Filtre',
                'playlists' => 'Çalma Listeleri',
                'server' => 'Sunucu & Araçlar'
            ]
        ],
        'ledger' => [
            'kicker' => 'Şeffaf Rakamlar',
            'title' => 'Basit, Samimi ve Güvenilir.',
            'rows' => [
                ['Fiyat', '0 TL / $0', 'Premium üyelik yok, paralı eklenti yok, kilitli özellik yok.'],
                ['Oylama Zorunluluğu', 'Sıfır', 'Müziğin durmaması için bot listelerinde oy vermeniz gerekmez.'],
                ['Sıra Limiti', '1000 Şarkı', 'Sunucu başına devasa sıra kapasitesi.'],
                ['Bellek Kullanımı', '~1 MB', 'Aktif oynatıcı başına ultra düşük RAM tüketimi (Nodelink v3).'],
                ['Müzik Kaynakları', '30+', 'YouTube, Spotify, SoundCloud, Apple Music, Deezer, Bandcamp, Twitch...'],
                ['Dil Desteği', '11 Dil', 'Türkçe, İngilizce, Portekizce, Japonca, Rusça ve daha fazlası.'],
                ['Aktif Sunucu', '1.300+', 'Gece 2\'de bile müzik dinleyen topluluklar için yapıldı.'],
                ['Lisans', 'MIT', 'Kaynak kodunu fork\'la, özelleştir veya kendi makinende barındır.']
            ]
        ],
        'host' => [
            'kicker' => 'Kendi Makinede Barındır',
            'title' => 'Üç Gereksinim, Beş Komut.',
            'body' => 'İhtiyacın olan tek şey Bun çalışma zamanı, bir Lavalink v4 / Nodelink v3 düğümü ve Discord Geliştirici Portalından alacağın bot tokeni.',
            'copy' => 'Tümünü Kopyala',
            'copied' => 'Kopyalandı!',
            'note' => 'Başlatmadan önce .env dosyasını bot tokenin ve Nodelink bilgilerinizle doldurun.',
            'guide_btn' => 'Nodelink Kurulum Rehberi',
            'video_btn' => 'Video Kurulum İzle'
        ],
        'faq' => [
            'kicker' => 'Merak Edilenler',
            'title' => 'Sıkça Sorulan Sorular',
            'items' => [
                [
                    'q' => 'Kenium gerçekten tamamen ücretsiz mi? Neden premium satmıyorsunuz?',
                    'a' => 'Evet, Kenium %100 açık kaynak ve topluluk odaklı bir projedir. Amacımız diğer botların oy kilidi ve pahalı aboneliklerle mahvettiği Discord müzik deneyimini özgürleştirmektir.'
                ],
                [
                    'q' => 'Botun ses kalitesi nasıl?',
                    'a' => 'Kenium, Discord\'un izin verdiği maksimum 384kbps yüksek bit hızında ses akışı sağlar. Nodelink ve Aqualink mimarisi sayesinde kesintisiz, gecikmesiz ve kayıpsız ses deneyimi sunar.'
                ],
                [
                    'q' => 'Kendi VDS sunucumda çalıştırabilir miyim?',
                    'a' => 'Kesinlikle! Kenium açık kaynak kodludur (MIT Lisansı). Bun ve bir Lavalink/Nodelink sunucusu kullanarak birkaç dakika içinde kendi sunucunuzda ayağa kaldırabilirsiniz.'
                ],
                [
                    'q' => 'Hangi müzik platformlarını destekliyor?',
                    'a' => 'Spotify çalma listeleri, YouTube, SoundCloud, Apple Music, Deezer, Bandcamp, Twitch canlı yayınları ve yerel ses dosyaları dahil olmak üzere 30\'dan fazla kaynağı doğrudan çalabilir.'
                ],
                [
                    'q' => '24/7 ses kanalında kalma özelliği ücretsiz mi?',
                    'a' => 'Evet! /247 komutu sayesinde Kenium herhangi bir ücret talep etmeden ses kanalında 7/24 kalabilir.'
                ]
            ]
        ],
        'footer' => [
            'title' => 'Sunucuna Müziği Getir.',
            'sub' => 'Tek bir tıkla sunucuna ekle, partiyi başlat.',
            'credit' => 'Topluluk için bağımsız bir geliştirici tarafından yapıldı. MIT Lisansı. Discord Inc. ile resmi bir bağı yoktur.',
            'quick_links' => 'Hızlı Bağlantılar',
            'back_to_top' => 'Yukarı Çık'
        ]
    ],
    'en' => [
        'nav' => [
            'how' => 'How it works',
            'demo' => 'Live Queue Demo',
            'filters' => 'Filters & Sound',
            'commands' => 'Commands',
            'numbers' => 'Numbers',
            'host' => 'Self-host',
            'faq' => 'FAQ',
            'add' => 'Add to Discord',
            'source' => 'GitHub'
        ],
        'hero' => [
            'badge' => 'Music for your Discord server',
            'lead' => 'Play the song. Skip the vote.',
            'sub' => 'YouTube, Spotify, SoundCloud. Put a song in voice and get on with your night. Free, with no premium tier or monthly vote.',
            'free_label' => 'Free. No premium. No votes.',
            'cta_add' => 'Add to Discord',
            'cta_code' => 'Read the source',
            'pluck_hint' => 'Pluck the line:',
            'status_online' => 'All Nodes Healthy & Online',
            'pill_memory' => '~1 MB RAM Per Player',
            'pill_free' => '$0 Lifetime Free',
            'pill_sources' => '30+ Audio Sources',
            'pill_uptime' => '24/7 Voice Ready'
        ],
        'queue_demo' => [
            'kicker' => 'Interactive Simulator',
            'title' => 'Discord Queue Simulator',
            'subtitle' => 'Experience how snappy Kenium responds right here in your browser.',
            'now_playing' => 'Now Playing',
            'up_next' => 'Up Next',
            'empty' => 'The queue is empty. Type /play to queue a track.',
            'loop_off' => 'Loop: Off',
            'loop_track' => 'Loop: Track',
            'loop_queue' => 'Loop: Queue',
            'live_note' => 'A sample queue. Simulated locally in browser.',
            'reset_btn' => 'Reset Queue',
            'actions_title' => 'Simulated Commands',
            'prompt_song' => 'Enter song title or URL to queue:'
        ],
        'journey' => [
            'kicker' => 'How it works',
            'title' => 'Follow one /play.',
            'intro' => 'Add Kenium, join voice, type /play. That\'s the setup.',
            'steps' => [
                [
                    'label' => '1. You',
                    'title' => 'You type /play',
                    'body' => 'A name or a URL, say lofi hip hop. Autocomplete kicks in after two letters, so most of the time you don\'t even finish the name.',
                    'badge' => 'User Input'
                ],
                [
                    'label' => '2. Discord',
                    'title' => 'Discord hands it to Kenium',
                    'body' => 'Bots get about three seconds to answer a command. Kenium acknowledges right away and does the actual work after.',
                    'badge' => '< 300ms Ack'
                ],
                [
                    'label' => '3. Aqualink',
                    'title' => 'Aqualink picks a node',
                    'body' => 'Aqualink is our own wrapper for talking to the node. It checks which nodes are alive and picks one with lowest load.',
                    'badge' => 'Load Balanced'
                ],
                [
                    'label' => '4. Nodelink',
                    'title' => 'The node does the heavy part',
                    'body' => 'Decoding, filters, mixing. The node is what actually decodes audio - Kenium barely touches it, which is why one player costs around 1 MB of RAM.',
                    'badge' => '~1 MB RAM'
                ],
                [
                    'label' => '5. Sources',
                    'title' => 'It finds your song',
                    'body' => 'Whatever the node can decode: YouTube, Spotify, SoundCloud, Apple Music, Deezer, and more. Playlists and plain URLs work too.',
                    'badge' => '30+ Platforms'
                ],
                [
                    'label' => '6. Voice Channel',
                    'title' => 'Sound comes out',
                    'body' => 'Audio streams straight into the voice channel at up to 384kbps. Nobody downloads a file.',
                    'badge' => '384kbps Direct Stream'
                ]
            ]
        ],
        'rack' => [
            'kicker' => 'Filters',
            'title' => 'Hear it, don\'t read about it.',
            'body' => 'Bass boost, nightcore, karaoke, and more. Use /filters in Discord, or test the Web Audio synthesizer below.',
            'start' => 'Start the loop',
            'stop' => 'Stop',
            'off_status' => 'Off. Press start.',
            'on_status' => 'Playing synth audio loop...',
            'speed' => 'Speed & Pitch',
            'modes' => [
                'normal' => 'Normal (Studio)',
                'bass' => 'Bass boost',
                'nightcore' => 'Nightcore',
                'slowed' => 'Slowed + Reverb',
                'muffled' => 'Muffled',
                'echo' => 'Echo (8D)'
            ]
        ],
        'commands' => [
            'kicker' => 'Commands',
            'title' => 'Type a slash.',
            'intro' => 'Start with /play. Use /search if you want options. Find a command by name or by what you want to do.',
            'search_placeholder' => 'Search commands, e.g. /play or lyrics...',
            'empty' => 'No commands found. Try another word or clear the search.',
            'copy_success' => 'Command copied to clipboard!',
            'categories' => [
                'all' => 'All',
                'playback' => 'Playback',
                'queue' => 'Queue',
                'filters' => 'Sound & Filters',
                'playlists' => 'Playlists',
                'server' => 'Server & Tools'
            ]
        ],
        'ledger' => [
            'kicker' => 'The numbers',
            'title' => 'Boring, on purpose.',
            'rows' => [
                ['Price', '$0', 'There is no premium tier. No vote, no subscribe, no wait - nothing is locked.'],
                ['Votes', 'None', 'You don\'t need to vote on a bot list to keep it playing. No loyalty program.'],
                ['Queue', '1000 songs', 'Per server queue capacity.'],
                ['Memory', '~1 MB', 'Per active player, or less, roughly. Nodelink does the heavy part.'],
                ['Sources', '30+', 'YouTube, Spotify, SoundCloud, Apple Music, Deezer, Bandcamp, Vimeo, Twitch...'],
                ['Languages', '11', 'English, Türkçe, Português, 日本語, Русский, العربية, and more.'],
                ['Servers', '1.3k+', 'Made for servers that live at 2am. And it keeps going up.'],
                ['License', 'MIT', 'Fork it, host it, rename it. Keep the credits if you fork it.']
            ]
        ],
        'host' => [
            'kicker' => 'Self-host',
            'title' => 'Three things, then five commands.',
            'body' => 'You need Bun (Node will not start it - that\'s a real constraint, not a vibe), a Lavalink v4 or Nodelink v3 server, and a bot token from the Discord developer portal.',
            'copy' => 'Copy All',
            'copied' => 'Copied!',
            'note' => 'Fill in .env with your bot token and your Nodelink details before starting.',
            'guide_btn' => 'Nodelink setup guide',
            'video_btn' => 'Short setup video'
        ],
        'faq' => [
            'kicker' => 'Got Questions?',
            'title' => 'Frequently Asked Questions',
            'items' => [
                [
                    'q' => 'Is Kenium really free? Why no premium tiers?',
                    'a' => 'Yes, Kenium is genuinely 100% free and open-source under the MIT license. We built it because we were tired of other bots demanding top.gg votes or charging monthly fees for basic playback.'
                ],
                [
                    'q' => 'What is the audio quality like?',
                    'a' => 'Kenium streams audio at the maximum bit rate allowed by Discord (up to 384kbps). Thanks to Nodelink, audio decoding is lossless, latency-free, and crystal clear.'
                ],
                [
                    'q' => 'Can I self-host this on my own VPS?',
                    'a' => 'Absolutely! Clone the GitHub repository, install dependencies with Bun, configure your .env file, and you are ready to run in less than 3 minutes.'
                ],
                [
                    'q' => 'Which music sources are supported?',
                    'a' => 'YouTube, Spotify playlists, SoundCloud, Apple Music, Deezer, Bandcamp, Twitch livestreams, and direct audio files.'
                ],
                [
                    'q' => 'Is 24/7 channel presence free?',
                    'a' => 'Yes! Simply use the /247 command to keep the bot connected in your voice channel around the clock without paying a cent.'
                ]
            ]
        ],
        'footer' => [
            'title' => 'Put it in your server.',
            'sub' => 'One click and a permissions screen.',
            'credit' => 'Made by a solo developer, for the community. MIT license. Not affiliated with Discord.',
            'quick_links' => 'Quick Links',
            'back_to_top' => 'Back to Top'
        ]
    ],
    'pt' => [
        'nav' => [
            'how' => 'Como funciona',
            'demo' => 'Simulador de Fila',
            'filters' => 'Filtros',
            'commands' => 'Comandos',
            'numbers' => 'Números',
            'host' => 'Self-host',
            'faq' => 'Perguntas',
            'add' => 'Adicionar ao Discord',
            'source' => 'GitHub'
        ],
        'hero' => [
            'badge' => 'Música pro seu servidor do Discord',
            'lead' => 'Toca a música. Pula o voto.',
            'sub' => 'YouTube, Spotify, SoundCloud. Coloca uma música no voice e segue a noite. Grátis, sem plano premium e sem voto mensal.',
            'free_label' => 'Grátis. Sem premium. Sem voto.',
            'cta_add' => 'Adicionar ao Discord',
            'cta_code' => 'Ver o código',
            'pluck_hint' => 'Toca na corda:',
            'status_online' => 'Todos os nós saudáveis e online',
            'pill_memory' => '~1 MB RAM por Player',
            'pill_free' => 'R$ 0 Para Sempre',
            'pill_sources' => '30+ Fontes de Áudio',
            'pill_uptime' => 'Voz 24/7 Grátis'
        ],
        'queue_demo' => [
            'kicker' => 'Simulador Interativo',
            'title' => 'Simulador de Fila do Discord',
            'subtitle' => 'Teste como o Kenium reage instantaneamente sem sair do navegador.',
            'now_playing' => 'Tocando Agora',
            'up_next' => 'Na Sequência',
            'empty' => 'A fila está vazia. Digite /play para adicionar.',
            'loop_off' => 'Repetir: Desligado',
            'loop_track' => 'Repetir: Faixa',
            'loop_queue' => 'Repetir: Fila',
            'live_note' => 'Uma fila de exemplo. Simulado localmente.',
            'reset_btn' => 'Recomeçar Fila',
            'actions_title' => 'Comandos Simulados',
            'prompt_song' => 'Digite o nome da música ou link:'
        ],
        'journey' => [
            'kicker' => 'Como funciona',
            'title' => 'Siga um /play.',
            'intro' => 'Adiciona o Kenium, entra no voice e digita /play. Esse é o setup.',
            'steps' => [
                [
                    'label' => '1. Você',
                    'title' => 'Você digita /play',
                    'body' => 'Um nome ou um link, tipo lofi hip hop. O autocomplete entra depois de duas letras.',
                    'badge' => 'Comando'
                ],
                [
                    'label' => '2. Discord',
                    'title' => 'O Discord passa pro Kenium',
                    'body' => 'Bot tem uns três segundos pra responder um comando. O Kenium confirma na hora.',
                    'badge' => '< 300ms'
                ],
                [
                    'label' => '3. Aqualink',
                    'title' => 'O Aqualink escolhe um node',
                    'body' => 'O Aqualink é o nosso próprio wrapper pra falar com o node com menor carga.',
                    'badge' => 'Balanceado'
                ],
                [
                    'label' => '4. Nodelink',
                    'title' => 'O node faz a parte pesada',
                    'body' => 'Decodificar, filtros, mixagem. Um player gasta uns 1 MB de RAM.',
                    'badge' => '~1 MB RAM'
                ],
                [
                    'label' => '5. Fontes',
                    'title' => 'Ele acha a sua música',
                    'body' => 'O que o node conseguir decodificar: YouTube, Spotify, SoundCloud, Apple Music, Deezer e mais.',
                    'badge' => '30+ Fontes'
                ],
                [
                    'label' => '6. Canal de voz',
                    'title' => 'O som sai',
                    'body' => 'O áudio vai direto pro canal de voz. Ninguém baixa arquivo.',
                    'badge' => '384kbps Direto'
                ]
            ]
        ],
        'rack' => [
            'kicker' => 'Filtros',
            'title' => 'Ouça, não leia sobre.',
            'body' => 'Bass boost, nightcore, karaoke e mais. Usa /filters no Discord ou testa o sintetizador aqui.',
            'start' => 'Iniciar o loop',
            'stop' => 'Parar',
            'off_status' => 'Desligado. Aperte iniciar.',
            'on_status' => 'Tocando um loop de sintetizador...',
            'speed' => 'Velocidade',
            'modes' => [
                'normal' => 'Normal',
                'bass' => 'Bass boost',
                'nightcore' => 'Nightcore',
                'slowed' => 'Slowed + Reverb',
                'muffled' => 'Abafado',
                'echo' => 'Eco'
            ]
        ],
        'commands' => [
            'kicker' => 'Comandos',
            'title' => 'Digite uma barra.',
            'intro' => 'Começa com /play. Usa /search se quiser opções. Encontre comandos por nome ou função.',
            'search_placeholder' => 'Buscar comandos, ex.: /play ou lyrics...',
            'empty' => 'Nenhum comando encontrado.',
            'copy_success' => 'Comando copiado!',
            'categories' => [
                'all' => 'Todos',
                'playback' => 'Reprodução',
                'queue' => 'Fila',
                'filters' => 'Som & Filtros',
                'playlists' => 'Playlists',
                'server' => 'Servidor'
            ]
        ],
        'ledger' => [
            'kicker' => 'Os números',
            'title' => 'Chato, de propósito.',
            'rows' => [
                ['Preço', 'R$ 0', 'Não existe plano premium. Sem voto, sem assinatura.'],
                ['Votos', 'Nenhum', 'Você não precisa votar em lista de bot pra ele continuar tocando.'],
                ['Fila', '1000 músicas', 'Por servidor.'],
                ['Memória', '~1 MB', 'Por player ativo. O Nodelink faz a parte pesada.'],
                ['Fontes', '30+', 'YouTube, Spotify, SoundCloud, Apple Music, Deezer e mais.'],
                ['Idiomas', '11', 'Português, English, Türkçe, 日本語, etc.'],
                ['Servidores', '1.3k+', 'Feito pra servidor que vive de madrugada.'],
                ['Licença', 'MIT', 'Código aberto com créditos originais mantidos.']
            ]
        ],
        'host' => [
            'kicker' => 'Self-host',
            'title' => 'Três coisas, depois cinco comandos.',
            'body' => 'Você precisa do Bun, um servidor Lavalink v4 ou Nodelink v3, e um token de bot do portal do Discord.',
            'copy' => 'Copiar',
            'copied' => 'Copiado!',
            'note' => 'Preencha o .env com o token do bot antes de iniciar.',
            'guide_btn' => 'Guia do Nodelink',
            'video_btn' => 'Vídeo de setup'
        ],
        'faq' => [
            'kicker' => 'Dúvidas',
            'title' => 'Perguntas Frequentes',
            'items' => [
                [
                    'q' => 'O Kenium é realmente grátis?',
                    'a' => 'Sim! 100% gratuito e open-source sob licença MIT.'
                ],
                [
                    'q' => 'Como é a qualidade do áudio?',
                    'a' => 'Até 384kbps, sem perdas e sem atrasos.'
                ],
                [
                    'q' => 'Posso rodar na minha VPS?',
                    'a' => 'Com certeza, usando Bun e Nodelink em menos de 5 minutos.'
                ],
                [
                    'q' => 'O 24/7 é liberado?',
                    'a' => 'Sim, o comando /247 funciona sem nenhum custo.'
                ]
            ]
        ],
        'footer' => [
            'title' => 'Coloque no seu servidor.',
            'sub' => 'Um clique e uma tela de permissões.',
            'credit' => 'Feito por um dev solo, pra comunidade. Licença MIT. Sem relação com o Discord.',
            'quick_links' => 'Links Rápidos',
            'back_to_top' => 'Voltar ao Topo'
        ]
    ]
];

// Helper to access translated string
function t($key, $default = '') {
    global $lang_data, $current_lang;
    $parts = explode('.', $key);
    $arr = $lang_data[$current_lang] ?? $lang_data['tr'];
    foreach ($parts as $p) {
        if (isset($arr[$p])) {
            $arr = $arr[$p];
        } else {
            // Fallback to English
            $fallback = $lang_data['en'];
            foreach ($parts as $fp) {
                if (isset($fallback[$fp])) {
                    $fallback = $fallback[$fp];
                } else {
                    return $default ?: $key;
                }
            }
            return $fallback;
        }
    }
    return $arr;
}

// All 37 Commands Catalog
$commands_list = [
    [
        'cmd' => 'play',
        'usage' => '/play <şarkı adı veya link>',
        'desc_tr' => 'Şarkı adı ara veya link yapıştır. 2 harften sonra otomatik tamamlama başlar.',
        'desc_en' => 'Search or paste a URL. Autocomplete kicks in after two letters.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'search',
        'usage' => '/search <sorgu>',
        'desc_tr' => 'Sıraya eklemeden önce arama sonuçlarından seçim yapın.',
        'desc_en' => 'See a few matches before you commit one to the queue.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'queue',
        'usage' => '/queue [sayfa]',
        'desc_tr' => 'Mevcut sırayı ve çalınacak şarkıları sayfalar halinde listeler (1000 şarkıya kadar).',
        'desc_en' => 'What\'s coming. The queue holds up to 1000 songs.',
        'cat' => 'queue'
    ],
    [
        'cmd' => 'skip',
        'usage' => '/skip',
        'desc_tr' => 'Çalan şarkıyı anında atlayıp sıradakine geçer.',
        'desc_en' => 'This one is over. Next track immediately.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'nowplaying',
        'usage' => '/nowplaying',
        'desc_tr' => 'Şarkı başlığı, süre çubuğu, ses kalitesi ve kimin eklediğini gösterir.',
        'desc_en' => 'Title, progress bar, audio quality and requester.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'pause',
        'usage' => '/pause',
        'desc_tr' => 'Kanaldan ayrılmadan oynatmayı duraklatır.',
        'desc_en' => 'Hold the track without leaving the channel.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'resume',
        'usage' => '/resume',
        'desc_tr' => 'Duraklatılan şarkıyı kaldığı yerden devam ettirir.',
        'desc_en' => 'Pick the playback right back up.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'stop',
        'usage' => '/stop',
        'desc_tr' => 'Müziği tamamen durdurur. Sıra siz temizleyene kadar korunur.',
        'desc_en' => 'End playback. Queue stays until you clear it.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'previous',
        'usage' => '/previous',
        'desc_tr' => 'Bir önceki çalınan şarkıya geri döner.',
        'desc_en' => 'Go back to the previously played song.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'seek',
        'usage' => '/seek <dakika:saniye>',
        'desc_tr' => 'Şarkının belirli bir saniyesine veya dakikasına atlar (örn: 1:30).',
        'desc_en' => 'Jump to a specific timestamp in the current track.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'volume',
        'usage' => '/volume <1-100>',
        'desc_tr' => 'Ses seviyesini ayarlar (1-100). Kulaklara nazik davranın.',
        'desc_en' => 'Set audio volume from 1 to 100.',
        'cat' => 'filters'
    ],
    [
        'cmd' => 'loop',
        'usage' => '/loop <mode: off | track | queue>',
        'desc_tr' => 'Şarkıyı veya tüm sırayı döngüye alır ya da kapatır.',
        'desc_en' => 'Loop the track, the queue, or turn it off.',
        'cat' => 'queue'
    ],
    [
        'cmd' => 'autoplay',
        'usage' => '/autoplay',
        'desc_tr' => 'Sıra bittiğinde otomatik olarak benzer parçalar bulup çalmaya devam eder.',
        'desc_en' => 'When queue ends, automatically keep going with related tracks.',
        'cat' => 'playback'
    ],
    [
        'cmd' => '247',
        'usage' => '/247',
        'desc_tr' => 'Ses kanalında 7/24 kalıcı kalır. Kesintisiz radyo ve sunucular için idealdir.',
        'desc_en' => 'Stay in voice channel 24/7 without disconnecting.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'filters',
        'usage' => '/filters <bassboost | nightcore | vaporwave | 8d | karaoke | clear>',
        'desc_tr' => 'Gelişmiş ses filtrelerini etkinleştirir veya sıfırlar.',
        'desc_en' => 'Enable or clear real-time audio filters.',
        'cat' => 'filters'
    ],
    [
        'cmd' => 'karaoke',
        'usage' => '/karaoke',
        'desc_tr' => 'Vokal frekansını filtreler ve enstrümantal karaoke modu oluşturur.',
        'desc_en' => 'Strip vocal frequencies for instrumental sing-along.',
        'cat' => 'filters'
    ],
    [
        'cmd' => 'lyrics',
        'usage' => '/lyrics [şarkı]',
        'desc_tr' => 'Çalan şarkının sözlerini senkronize olarak getirir.',
        'desc_en' => 'Pull synced lyrics for current song in real time.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'play-file',
        'usage' => '/play-file <dosya_eki>',
        'desc_tr' => 'Discord\'a yüklediğiniz özel bir MP3/WAV/FLAC dosyasını çalar.',
        'desc_en' => 'Upload and play a direct audio file from Discord.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'tts',
        'usage' => '/tts <metin>',
        'desc_tr' => 'Yazdığınız metni ses kanalında yapay zeka sesiyle seslendirir.',
        'desc_en' => 'Text-to-speech reading in the voice channel.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'shuffle',
        'usage' => '/shuffle',
        'desc_tr' => 'Sıradaki tüm şarkıları rastgele sıraya karıştırır.',
        'desc_en' => 'Randomly reorder all upcoming songs in queue.',
        'cat' => 'queue'
    ],
    [
        'cmd' => 'jump',
        'usage' => '/jump <sıra_no>',
        'desc_tr' => 'Sıradaki belirli bir numaralı şarkıya anında atlar.',
        'desc_en' => 'Skip directly ahead to a specific queue index.',
        'cat' => 'queue'
    ],
    [
        'cmd' => 'remove',
        'usage' => '/remove <sıra_no>',
        'desc_tr' => 'Sıradan istenmeyen belirli bir şarkıyı çıkarır.',
        'desc_en' => 'Drop a specific track from the queue.',
        'cat' => 'queue'
    ],
    [
        'cmd' => 'clear',
        'usage' => '/clear',
        'desc_tr' => 'Çalan şarkı hariç tüm sırayı anında boşaltır.',
        'desc_en' => 'Empty all upcoming tracks from queue.',
        'cat' => 'queue'
    ],
    [
        'cmd' => 'roulette',
        'usage' => '/roulette',
        'desc_tr' => 'Sıradan tamamen şans eseri rastgele bir şarkıyı seçip çalar.',
        'desc_en' => 'Play a completely random track from queue (Party mode).',
        'cat' => 'queue'
    ],
    [
        'cmd' => 'grab',
        'usage' => '/grab',
        'desc_tr' => 'Şu an çalan şarkının Spotify/YouTube linkini özel mesaj olarak size yollar.',
        'desc_en' => 'DM yourself the current track so you never lose it.',
        'cat' => 'playback'
    ],
    [
        'cmd' => 'export',
        'usage' => '/export',
        'desc_tr' => 'Mevcut sırayı kod olarak dışa aktarır (daha sonra içe aktarabilirsiniz).',
        'desc_en' => 'Dump the current queue to import it later.',
        'cat' => 'playlists'
    ],
    [
        'cmd' => 'import',
        'usage' => '/import <kod>',
        'desc_tr' => 'Daha önce dışa aktarılan sırayı tekrar yükler.',
        'desc_en' => 'Load a previously exported queue file or code.',
        'cat' => 'playlists'
    ],
    [
        'cmd' => 'playlist',
        'usage' => '/playlist <create | add | play | list | delete>',
        'desc_tr' => 'Kullanıcıya özel kalıcı çalma listeleri oluşturur ve yönetir.',
        'desc_en' => 'Create and manage custom playlists saved to your user.',
        'cat' => 'playlists'
    ],
    [
        'cmd' => 'changelog',
        'usage' => '/changelog',
        'desc_tr' => 'Botun son güncellemelerini ve yeniliklerini listeler.',
        'desc_en' => 'What changed recently in the bot codebase.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'invite',
        'usage' => '/invite',
        'desc_tr' => 'Bot davet bağlantısı, GitHub reposu ve destek sunucusu linklerini verir.',
        'desc_en' => 'Links for the bot, GitHub repo, and support server.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'ping',
        'usage' => '/ping',
        'desc_tr' => 'Discord API ve WebSocket gecikme sürelerini ölçer.',
        'desc_en' => 'Display bot and Discord WebSocket latency.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'sources',
        'usage' => '/sources',
        'desc_tr' => 'Bağlı Nodelink düğümünün çalabildiği tüm müzik platformlarını listeler.',
        'desc_en' => 'What connected Nodelink node can actually decode.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'status',
        'usage' => '/status',
        'desc_tr' => 'Aktif oynatıcılar, düğümler, uptime ve RAM kullanımını gösterir.',
        'desc_en' => 'Active players, connected nodes, uptime, and memory.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'lenguage',
        'usage' => '/lenguage <dil_kodu>',
        'desc_tr' => 'Botun sunucudaki dilini değiştirir (Türkçe, İngilizce vb.).',
        'desc_en' => 'Set bot language in this server.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'restart',
        'usage' => '/restart',
        'desc_tr' => 'Bu sunucudaki oynatıcıyı yeniden başlatır ve bağlantıyı tazeler.',
        'desc_en' => 'Restart player in this server and renew audio socket.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'destroy',
        'usage' => '/destroy',
        'desc_tr' => 'Oynatıcıyı tamamen kapatır, sırayı temizler ve ses kanalından ayrılır.',
        'desc_en' => 'Tear player down. Queue gone. Voice left.',
        'cat' => 'server'
    ],
    [
        'cmd' => 'help',
        'usage' => '/help [kategori]',
        'desc_tr' => 'Tüm komutların açıklamalı ve kategorik rehberini açar.',
        'desc_en' => 'The full in-Discord command deck and guide.',
        'cat' => 'server'
    ]
];
