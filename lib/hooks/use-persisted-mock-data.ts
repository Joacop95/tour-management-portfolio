"use client"

import { useSyncExternalStore } from "react"

import { guideAvailability } from "@/lib/mock-data/availability"
import { circuits as mockCircuits, tourGroups } from "@/lib/mock-data/groups"
import { guides as mockGuides } from "@/lib/mock-data/guides"
import { isProduction } from "@/lib/auth/runtime-mode"
import type {
  Circuit,
  Guide,
  GuideAvailability,
  TourGroup,
} from "@/lib/types/domain"
import {
  localStorageKeys,
  readLocalStorageValue,
  subscribeToLocalStorage,
} from "@/lib/utils/local-storage"

const noGuides: Guide[] = []
const noGroups: TourGroup[] = []
const noAvailability: GuideAvailability[] = []
const noCircuits: Circuit[] = []

function readPersistedArray<T>(key: string, fallback: T[]) {
  const value = readLocalStorageValue<unknown>(key, fallback)

  return Array.isArray(value) ? (value as T[]) : fallback
}

function readPersistedCircuits() {
  if (isProduction) return noCircuits
  const storedCircuits = readPersistedArray<Circuit>(
    localStorageKeys.circuits,
    mockCircuits
  )

  if (storedCircuits !== mockCircuits) {
    return storedCircuits
  }

  const oldEquivalences = readLocalStorageValue<
    Array<{
      appCircuitId: string
      aliases?: string[]
      notes?: string
      isActive?: boolean
      createdAtIso?: string
      updatedAtIso?: string
      updatedBy?: string
    }>
  >(localStorageKeys.circuitEquivalences, [])

  if (!Array.isArray(oldEquivalences) || oldEquivalences.length === 0) {
    return mockCircuits
  }

  return mockCircuits.map((circuit) => {
    const oldEquivalence = oldEquivalences.find(
      (equivalence) => equivalence.appCircuitId === circuit.id
    )

    if (!oldEquivalence) {
      return circuit
    }

    return {
      ...circuit,
      aliases: oldEquivalence.aliases ?? circuit.aliases,
      isActive: oldEquivalence.isActive ?? circuit.isActive ?? true,
      notes: oldEquivalence.notes ?? circuit.notes,
      createdAtIso: oldEquivalence.createdAtIso ?? circuit.createdAtIso,
      updatedAtIso: oldEquivalence.updatedAtIso ?? circuit.updatedAtIso,
      updatedBy: oldEquivalence.updatedBy ?? circuit.updatedBy,
    }
  })
}

export function usePersistedGuides() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    () => isProduction ? noGuides : readPersistedArray<Guide>(localStorageKeys.guides, mockGuides),
    () => isProduction ? noGuides : mockGuides
  )
}

export function usePersistedGroups() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    () => isProduction ? noGroups : readPersistedArray<TourGroup>(localStorageKeys.groups, tourGroups),
    () => isProduction ? noGroups : tourGroups
  )
}

export function usePersistedAvailability() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    () => isProduction ? noAvailability :
      readPersistedArray<GuideAvailability>(
        localStorageKeys.availability,
        guideAvailability
      ),
    () => isProduction ? noAvailability : guideAvailability
  )
}

export function usePersistedCircuits() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    readPersistedCircuits,
    () => isProduction ? noCircuits : mockCircuits
  )
}
