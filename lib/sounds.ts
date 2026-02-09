import { createAudioPlayer, AudioPlayer } from 'expo-audio';

const expenseSource = require('@/assets/sounds/expense.wav');
const incomeSource = require('@/assets/sounds/income.wav');

let expensePlayer: AudioPlayer | null = null;
let incomePlayer: AudioPlayer | null = null;

export function loadSounds(): void {
  try {
    if (!expensePlayer) {
      expensePlayer = createAudioPlayer(expenseSource);
    }
    if (!incomePlayer) {
      incomePlayer = createAudioPlayer(incomeSource);
    }
  } catch (e) {
  }
}

export async function playExpenseSound(): Promise<void> {
  try {
    if (!expensePlayer) loadSounds();
    if (expensePlayer) {
      expensePlayer.seekTo(0);
      expensePlayer.play();
    }
  } catch (e) {
  }
}

export async function playIncomeSound(): Promise<void> {
  try {
    if (!incomePlayer) loadSounds();
    if (incomePlayer) {
      incomePlayer.seekTo(0);
      incomePlayer.play();
    }
  } catch (e) {
  }
}

export function unloadSounds(): void {
  try {
    if (expensePlayer) {
      expensePlayer.release();
      expensePlayer = null;
    }
    if (incomePlayer) {
      incomePlayer.release();
      incomePlayer = null;
    }
  } catch (e) {
  }
}
