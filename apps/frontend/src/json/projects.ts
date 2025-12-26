import type { Project } from "@/types/Project";

const PROJECTS: { [key: string]: Project } = {
  "multiverse": {
    name: {
      en: "Playa: Multiverse",
      es: "Playa: Multiverso",
      pt: "Playa: Multiverso"
    },
    description: {
      en: "A socialy distanced and virtual 2020 simulation of what would happen on Playa",
      es: "Una simulación virtual, con distanciamiento social, de todo lo que ocurriría en Playa en 2020",
      pt: "Uma simulação, de 2020, virtual e socialmente distanciada de tudo o que aconteceria na Playa"
    },
    company: {
      en: "Celestial Bodies",
      es: "Campamento Celestial Bodies",
      pt: "Celestial Bodies"
    },
    role: {
      en: "Collaborator",
      es: "Colaborador Independiente",
      pt: "Colaborador"
    },
    "year": 2020,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["JavaScript", "ES6", "HTML5", "CSS3"],
    "thumbImgUrl": "/img/portfolio/multiverse/multiverse_thumb.jpg",
    "thumbAspectRatio": 0.9,
    "thumbVideoUrl": "/img/portfolio/multiverse/multiverse_thumb.mp4",
    "videoUrl": "https://youtu.be/niPZFy9t9b0",
    "liveDemoUrl": "https://multiverse.campcelestialbodies.org/"
  },
  "chatbot": {
    name: {
      en: "AI Chatbot",
      es: "Chatbot IA",
      pt: "Chatbot IA"
    },
    description: {
      en: "A chatbot powered by the Large Language Model Qwen 2.5, by Alibaba Cloud",
      es: "Un asistente desarrollado con el modelo de lenguaje a gran escala Qwen 2.5 de Alibaba Cloud",
      pt: "Um assistente desenvolvido utilizando o Modelo de linguagem de grande escala Qwen 2.5, da Alibaba Cloud"
    },
    company: {
      en: "Personal Project",
      es: "Projecto Independiente",
      pt: "Projeto Independente"
    },
    role: {
      en: "Full Stack / AI Engineer",
      es: "Desarrollador Full Stack / IA",
      pt: "Desenvolvedor Full Stack / IA"
    },
    "year": 2025,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["Vue 3", "Python", "Hugging Face Transformers", "LLMs", "JavaScript", "ES6", "HTML5", "CSS3"],
    "thumbImgUrl": "/img/portfolio/chatbot/chatbot_thumb.png",
    "thumbAspectRatio": 1.15,
    "thumbVideoUrl": "/img/portfolio/chatbot/chatbot_thumb.mp4",
    "githubUrl": "https://github.com/jezzlucena/vue-ai-chatbot",
    "liveDemoUrl": "https://chatbot.jezzlucena.xyz/"
  },
  "climatempo": {
    name: {
      en: "Climatempo",
      es: "Climatempo",
      pt: "Climatempo"
    },
    description: {
      en: "The leading weather forecast cross-platform app in Brazil",
      es: "La aplicación líder de pronóstico del tiempo multiplataforma en Brasil",
      pt: "O aplicativo multi-plataforma líder em previsão do tempo no Brasil"
    },
    company: {
      en: "HXD Smart Solutions",
      es: "HXD Smart Solutions",
      pt: "HXD Smart Solutions"
    },
    role: {
      en: "Full Stack Engineer",
      es: "Desarrollador Full Stack",
      pt: "Desenvolvedor Full Stack"
    },
    "year": 2012,
    "platforms": ["Samsung SmartTV OS", "LG SmartTV OS", "Web"],
    "stack": ["JavaScript", "XML", "JSON", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/climatempo/climatempo_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/climatempo/climatempo_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/climatempo/climatempo_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097271/Climatempo-Weather-Forecast",
  },
  "dell": {
    name: {
      en: "Dell Training Game",
      es: "Dell Game Educativo",
      pt: "Dell Game Educativo"
    },
    description: {
      en: "Dell's gamified experience to showcase their cutting-edge corporate server deployment application",
      es: "Experiencia gamificada de Dell para educar sobre su aplicación de implementación de servidores perimetrales",
      pt: "A experiência gamificada da Dell para educar sobre seu aplicativo de implantação de servidores de ponta"
    },
    company: {
      en: "Kaon Interactive",
      es: "Kaon Interactive",
      pt: "Kaon Interactive"
    },
    role: {
      en: "Full Stack Engineer",
      es: "Desarrollador Full Stack",
      pt: "Desenvolvedor Full Stack"
    },
    "year": 2018,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["WebSockets", "SQLite", "JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/dell/dell_thumb.jpg",
    "thumbAspectRatio": 0.8,
    "thumbVideoUrl": "/img/portfolio/dell/dell_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/dell/dell_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097417/Dell-OME-Gamified-Experience",
    "videoUrl": "https://youtu.be/McDy33GSPUM",
    "liveDemoUrl": "https://demos.jezzlucena.com/DellOME"
  },
  "thermofisher": {
    name: {
      en: "Precision Medicine",
      es: "Precision Medicine",
      pt: "Precision Medicine"
    },
    description: {
      en: "Thermo Fisher Scientific's Precision Medicine technology showcase app",
      es: "La aplicación de presentación de la tecnología de Medicina de Precisión de Thermo Fisher Scientific",
      pt: "O aplicativo vitrine da tecnologia de Medicina de Precisão da Thermo Fisher Scientific"
    },
    company: {
      en: "Thermo Fisher",
      es: "Thermo Fisher",
      pt: "Thermo Fisher"
    },
    role: {
      en: "Full Stack Engineer",
      es: "Desarrollador Full Stack",
      pt: "Desenvolvedor Full Stack"
    },
    "year": 2018,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/thermofisher/thermo_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/thermofisher/thermo_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/thermofisher/thermo_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097771/Thermo-Fisher-Precision-Medicine",
    "videoUrl": "https://youtu.be/JUgZ73YrFKs",
    "liveDemoUrl": "https://demos.jezzlucena.com/ThermoFisher_ADN"
  },
  "abbott": {
    name: {
      en: "Abbott Transformation",
      es: "Abbott Transformation",
      pt: "Abbott Transformation"
    },
    description: {
      en: "B2B sales showcase for Abbott Diagnostics' Transformation laboratory solutions",
      es: "Exhibición de ventas B2B para las soluciones de laboratorio Transformation, de Abbott Diagnostics",
      pt: "Vitrine de vendas B2B das soluções de laboratório Transformation, da Abbott Diagnostics"
    },
    company: {
      en: "Kaon Interactive",
      es: "Kaon Interactive",
      pt: "Kaon Interactive"
    },
    role: {
      en: "Front End Engineer",
      es: "Desarrollador Front-End",
      pt: "Desenvolvedor Front End"
    },
    "year": 2016,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n", "Gather Content"],
    "thumbImgUrl": "/img/portfolio/abbott/abbott_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/abbott/abbott_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/abbott/abbott_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74096955/Abbott-Transformation",
    "videoUrl": "https://youtu.be/CLGU7GhBO0k",
    "liveDemoUrl": "https://demos.jezzlucena.com/Transformation_ADN"
  },
  "strikeapose": {
    name: {
      en: "Strike A Pose",
      es: "Strike A Pose",
      pt: "Strike A Pose"
    },
    description: {
      en: "A dystopian rhythm action-adventure video game, but make it fashion",
      es: "Un juego distópico, rítmico, y de acción-aventura; pero fashion",
      pt: "Um game distópico de rítmo, ação-aventura; porém fashion"
    },
    company: {
      en: "Personal Project",
      es: "Projecto Independiente",
      pt: "Projeto Independente"
    },
    role: {
      en: "Game Designer and Engineer",
      es: "Desarrollador Principal y Game Designer",
      pt: "Game Designer e Desenvolvedor"
    },
    "year": 2020,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "Heroku"],
    "thumbImgUrl": "/img/portfolio/strikeapose/strikeapose_thumb.jpg",
    "thumbAspectRatio": 0.74,
    "thumbVideoUrl": "/img/portfolio/strikeapose/strikeapose_thumb.mp4",
    "videoUrl": "https://youtu.be/zbpl4O8iWtE"
  },
  "kaon": {
    name: {
      en: "Kaon.com",
      es: "Kaon.com",
      pt: "Kaon.com"
    },
    description: {
      en: "Kaon creates advanced software technology and platforms to enable global companies to simplify their complex stories at every customer touch-point",
      es: "Kaon crea tecnología y plataformas de vanguardia que permiten a las empresas globales simplificar sus complejas historias, al alcance de cada consumidor",
      pt: "A Kaon cria tecnologia de ponta e plataformas que empoderam companhias globais a simplificar suas complexas histórias; ao toque de todo consumidor"
    },
    company: {
      en: "Kaon Interactive",
      es: "Kaon Interactive",
      pt: "Kaon Interactive"
    },
    role: {
      en: "Senior Full Stack Engineer",
      es: "Desarrollador Full Stack Senior",
      pt: "Desenvolvedor Full Stack Sênior"
    },
    "year": 2017,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["Ruby on Rails", "MongoDB", "JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/kaon/kaon_thumb.jpg",
    "thumbAspectRatio": 1.15,
    "thumbVideoUrl": "/img/portfolio/kaon/kaon_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/kaon/kaon_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74096433/Kaoncom",
    "videoUrl": "https://youtu.be/2RX7FPld2lI",
    "liveDemoUrl": "http://www.kaon.com/"
  },
  "dxma": {
    name: {
      en: "DxMA Awards 2016",
      es: "Premios DxMA 2016",
      pt: "Prêmios DxMA 2016"
    },
    description: {
      en: "The digital catalog for DxMA's best B2B apps award ceremony",
      es: "El catálogo digital de la ceremonia de entrega de premios DxMA a las mejores aplicaciones B2B",
      pt: "O catálogo digital da cerimônia de prêmios DxMA de melhores aplicativos B2B"
    },
    company: {
      en: "Kaon Interactive",
      es: "Kaon Interactive",
      pt: "Kaon Interactive"
    },
    role: {
      en: "Full Stack Engineer",
      es: "Desarrollador Full Stack",
      pt: "Desenvolvedor Full Stack"
    },
    "year": 2016,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/dxma/dxma_thumb.jpg",
    "thumbAspectRatio": 1.74,
    "thumbVideoUrl": "/img/portfolio/dxma/dxma_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/dxma/dxma_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097473/DxMA-Awards-Catalog",
    "videoUrl": "https://youtu.be/aQ6I_z8w9vo",
    "liveDemoUrl": "https://demos.jezzlucena.com/DxMA_2016"
  },
  "f5": {
    name: {
      en: "F5 Hybrid Cloud",
      es: "F5 Hybrid Cloud",
      pt: "F5 Hybrid Cloud"
    },
    description: {
      en: "A showcase app for F5 Networks' best practices on cloud computing and security",
      es: "Una aplicación que muestra las mejores prácticas de F5 Networks en ciberseguridad y computación en la nube",
      pt: "Um aplicativo vitrine das melhores práticas em cyber-segurança e computação na núvem da F5 Networks"
    },
    company: {
      en: "Kaon Interactive",
      es: "Kaon Interactive",
      pt: "Kaon Interactive"
    },
    role: {
      en: "Full Stack Engineer",
      es: "Desarrollador Full Stack",
      pt: "Desenvolvedor Full Stack"
    },
    "year": 2016,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/f5/f5_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/f5/f5_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/f5/f5_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097513/F5-Hybrid-Cloud",
    "videoUrl": "https://youtu.be/Bp1X9JAe0VE",
    "liveDemoUrl": "https://demos.jezzlucena.com/F5_ADN"
  },
  "hyundai": {
    name: {
      en: "Hyundai HB20s",
      es: "Hyundai HB20s",
      pt: "Hyundai HB20s"
    },
    description: {
      en: "Hyundai's marketing app for the launch of HB20 and HB20s new models in Brazil",
      es: "Aplicación de marketing de Hyundai para el lanzamiento de sus líneas HB20 y HB20s en Brasil",
      pt: "O aplicativo de marketing da Hyundai para o lançamento de sua linha HB20 e HB20s no Brasil"
    },
    company: {
      en: "HXD Smart Solutions",
      es: "HXD Smart Solutions",
      pt: "HXD Smart Solutions"
    },
    role: {
      en: "Full Stack Engineer",
      es: "Desarrollador Full Stack",
      pt: "Desenvolvedor Full Stack"
    },
    "year": 2013,
    "platforms": ["Samsung SmartTV OS", "LG SmartTV OS", "Web"],
    "stack": ["JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/hyundai/hyundai_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/hyundai/hyundai_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/hyundai/hyundai_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097571/Hyundai-HB20s-Launch",
  },
  "photobooth": {
    name: {
      en: "Photobooth",
      es: "Photobooth",
      pt: "Photobooth"
    },
    description: {
      en: "A web application that snaps a picture when you smile. Machine Learning, AI, and Material Design included",
      es: "Una aplicación web que toma una foto cuando sonríes; incluye aprendizaje automático, IA y Material Design",
      pt: "Uma aplicação web que tira uma foto quando você sorri; Aprendizado de Máquina, IA, e Design Material incluídos"
    },
    company: {
      en: "Personal Project",
      es: "Projecto Independiente",
      pt: "Projeto Independente"
    },
    role: {
      en: "Designer / AI Engineer",
      es: "Designer / Desarrollador IA",
      pt: "Designer / Desenvolvedor IA"
    },
    "year": 2019,
    "platforms": ["iOS", "Android", "Desktop", "Web"],
    "stack": ["JavaScript", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/photobooth/photobooth_thumb.jpg",
    "thumbAspectRatio": 0.74,
    "thumbVideoUrl": "/img/portfolio/photobooth/photobooth_thumb.mp4",
    "videoUrl": "https://youtu.be/N8bxdOAP8Aw",
    "githubUrl": "https://github.com/jezzlucena/face-api-photobooth",
    "liveDemoUrl": "https://photobooth.jezzlucena.com"
  },
  "haystack": {
    name: {
      en: "In a Haystack",
      es: "In a Haystack",
      pt: "In a Haystack"
    },
    description: {
      en: "A graduate thesis proof-of-concept video game project implementation",
      es: "Implementación de un proyecto de juego para una tesis de maestría, prueba de concepto",
      pt: "Implementação de um game-projeto de tese de mestrado, prova de conceito"
    },
    company: {
      en: "WPI",
      es: "WPI",
      pt: "WPI"
    },
    role: {
      en: "Game Designer and Engineer",
      es: "Desarrollador Principal y Game Designer",
      pt: "Game Designer e Desenvolvedor"
    },
    "year": 2016,
    "platforms": ["Desktop", "Web", "iOS"],
    "stack": ["RPGMaker MV Script", "Game Design", "JavaScript", "JSON", "ES6", "i18n"],
    "thumbImgUrl": "/img/portfolio/in-a-haystack/haystack_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/in-a-haystack/haystack_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/in-a-haystack/haystack_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097641/In-a-Haystack",
    "liveDemoUrl": "https://demos.jezzlucena.com/In_a_Haystack"
  },
  "cocacola": {
    name: {
      en: "Coca-Cola FM",
      es: "Coca-Cola FM",
      pt: "Coca-Cola FM"
    },
    description: {
      en: "Coca-Cola FM's official Smart TV app in Latin America",
      es: "La app oficial de Coca-Cola FM para SmartTVs en Latinoamérica",
      pt: "O aplicativo oficial da Coca-Cola FM para SmarTVs na América Latina"
    },
    company: {
      en: "HXD Smart Solutions",
      es: "HXD Smart Solutions",
      pt: "HXD Smart Solutions"
    },
    role: {
      en: "Software Engineer",
      es: "Ingeniero de Software",
      pt: "Engenheiro de Software"
    },
    "year": 2012,
    "platforms": ["LG SmartTV OS", "Web"],
    "stack": ["ActionScript 3", "XML", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/coca-cola/coca_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/coca-cola/coca_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/coca-cola/coca_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097365/Coca-Cola-FM",
  },
  "pong4x": {
    name: {
      en: "Pong! 4X",
      es: "Pong! 4X",
      pt: "Pong! 4X"
    },
    description: {
      en: "Proof-of-concept computer game that takes the classic Pong to a whole new hectic multiplayer experience",
      es: "Juego de prueba de concepto que eleva el clásico Pong a un nuevo nivel de experiencia multijugador innovador y frenético",
      pt: "Game prova-de-conceito que eleva o clássico Pong a um inovador e frenético novo patamar de experiência multiplayer"
    },
    company: {
      en: "Personal Project",
      es: "Projecto Independiente",
      pt: "Projeto Independente"
    },
    role: {
      en: "Game Designer and Engineer",
      es: "Desarrollador Principal y Game Designer",
      pt: "Game Designer e Desenvolvedor"
    },
    "year": 2014,
    "platforms": ["Desktop"],
    "stack": ["Processing 3", "Game Design", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/pong-4x/pong4x_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/pong-4x/pong4x_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/pong-4x/pong4x_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097689/Pong-4X",
    "githubUrl": "https://github.com/jezzlucena/pong_4x",
    "liveDemoUrl": "https://demos.jezzlucena.com/Pong_4X"
  },
  "bandip": {
    name: {
      en: "Band IP",
      es: "Band IP",
      pt: "Band IP"
    },
    description: {
      en: "Band TV's leading video-on-demand multiplatform app in Brazil",
      es: "La aplicación líder de TV Bandeirantes para streaming de video a pedido multiplataforma OTT en Brasil",
      pt: "O aplicativo líder da TV Bandeirantes para transmissão de video-em-demanda OTT multiplataforma no Brasil"
    },
    company: {
      en: "HXD Smart Solutions",
      es: "HXD Smart Solutions",
      pt: "HXD Smart Solutions"
    },
    role: {
      en: "Full Stack Engineer",
      es: "Desarrollador Full Stack",
      pt: "Desenvolvedor Full Stack"
    },
    "year": 2013,
    "platforms": ["Samsung SmartTV OS", "LG SmartTV OS", "Web"],
    "stack": ["JavaScript", "XML", "JSON", "ES6", "HTML5", "CSS3", "UX/UI Design", "i18n"],
    "thumbImgUrl": "/img/portfolio/band-ip/band_thumb.jpg",
    "thumbVideoUrl": "/img/portfolio/band-ip/band_thumb.mp4",
    "thumbGifUrl": "/img/portfolio/band-ip/band_0.gif",
    "behanceUrl": "https://www.behance.net/gallery/74097179/Band-IP",
  }
}

export default PROJECTS;
