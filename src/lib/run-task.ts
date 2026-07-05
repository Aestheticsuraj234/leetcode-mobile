import { runTask } from 'expo-server'


export function runTaskAsync<T>(fn: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      runTask(async () => {
        try {
          resolve(await fn())
        } catch (error) {
          reject(error)
        }
      })
    })
  }
  