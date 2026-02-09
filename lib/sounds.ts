import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';

let expenseSound: Sound | null = null;
let incomeSound: Sound | null = null;
let loaded = false;

export async function loadSounds(): Promise<void> {
  if (loaded) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });

    const { sound: es } = await Audio.Sound.createAsync(
      require('@/assets/sounds/expense.wav')
    );
    expenseSound = es;

    const { sound: is } = await Audio.Sound.createAsync(
      require('@/assets/sounds/income.wav')
    );
    incomeSound = is;

    loaded = true;
  } catch (e) {
  }
}

export async function playExpenseSound(): Promise<void> {
  try {
    if (!expenseSound) await loadSounds();
    if (expenseSound) {
      await expenseSound.setPositionAsync(0);
      await expenseSound.playAsync();
    }
  } catch (e) {
  }
}

export async function playIncomeSound(): Promise<void> {
  try {
    if (!incomeSound) await loadSounds();
    if (incomeSound) {
      await incomeSound.setPositionAsync(0);
      await incomeSound.playAsync();
    }
  } catch (e) {
  }
}

export async function unloadSounds(): Promise<void> {
  try {
    if (expenseSound) {
      await expenseSound.unloadAsync();
      expenseSound = null;
    }
    if (incomeSound) {
      await incomeSound.unloadAsync();
      incomeSound = null;
    }
    loaded = false;
  } catch (e) {
  }
}
