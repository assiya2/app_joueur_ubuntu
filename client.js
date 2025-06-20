const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketClient = require('socket.io-client');
const Speaker = require('speaker');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connexion au serveur entraîneur
const TRAINER_SERVER = 'http://localhost:4000'; // ou votre IP
const trainerSocket = socketClient(TRAINER_SERVER, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

let speaker = null;
let speakerReady = false;

let playerData = {
  nom: 'Joueur Test',
  position: 'Attaquant',
  avatar: 'https://via.placeholder.com/100',
  status: 'offline'
};

trainerSocket.on('connect', () => {
  console.log('Connecté au serveur entraîneur');
  playerData.status = 'online';
  
  // S'enregistrer comme joueur
  trainerSocket.emit('register-player', {
    nom: playerData.nom,
    position: playerData.position,
    avatar: playerData.avatar
  });
  
  console.log(` Joueur enregistré: ${playerData.nom}`);
});

trainerSocket.on('connect_error', (err) => {
  console.error(' Erreur de connexion:', err.message);
  playerData.status = 'error';
});

trainerSocket.on('disconnect', () => {
  console.log( 'Déconnecté du serveur entraîneur');
  playerData.status = 'offline';
  if (speaker) {
    speaker.end();
    speaker = null;
    speakerReady = false;
  }
});

// === CORRECTION PRINCIPALE ===
// Le serveur envoie 'audio-stream', pas 'audio-chunk'
trainerSocket.on('audio-stream', (audioData) => {
  console.log('🎵 Audio reçu:', audioData.length, 'octets');

  try {
    if (!speakerReady) {
      speaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 16000
      });
      speakerReady = true;
      
      speaker.on('close', () => {
        console.log(' Speaker fermé');
        speakerReady = false;
        speaker = null;
      });
      
      speaker.on('error', (err) => {
        console.error(' Erreur speaker:', err);
        speakerReady = false;
        speaker = null;
      });
    }

    if (speaker && speakerReady) {
      speaker.write(audioData);
    }
  } catch (error) {
    console.error(' Erreur lecture audio:', error);
  }
});

// Gestion de la fin du streaming
trainerSocket.on('coach-stream-stopped', (data) => {
  console.log('Communication arrêtée par:', data.coachName);
  if (speaker) {
    speaker.end();
    speaker = null;
    speakerReady = false;
  }
});

// Notification de début de streaming
trainerSocket.on('coach-streaming', (data) => {
  console.log(` ${data.coachName} commence une communication vers:`, data.targets);
  if (data.targets.includes(playerData.nom)) {
    console.log('Je suis ciblé par cette communication !');
  }
});

// Serveur web pour l'interface
app.use(express.static(path.join(__dirname, 'public')));

server.listen(3000, '0.0.0.0', () => {
  console.log(' Interface joueur démarrée sur http://localhost:3000');
  console.log(`Joueur: ${playerData.nom} (${playerData.position})`);
});