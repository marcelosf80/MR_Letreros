"""Genetic search over (piece order, rotation choice) to minimize used_length.
"""
from __future__ import annotations

import random
from dataclasses import dataclass

from .geometry import Piece
from .placement import place_on_sheet, used_length, Placement
from .nfp import clear_nfp_cache


@dataclass
class NestResult:
    placements: list[Placement]
    unplaced_piece_ids: list[str]
    used_length_mm: float
    sheet_width_mm: float
    generations_run: int


def _expand_quantities(pieces: list[Piece]) -> list[Piece]:
    """One GA gene per physical piece instance, not per distinct shape."""
    expanded = []
    for p in pieces:
        for i in range(p.quantity):
            expanded.append(Piece(id=f"{p.id}#{i}", contour=p.contour, quantity=1,
                                   allowed_rotations=p.allowed_rotations))
    return expanded


def _random_individual(pieces: list[Piece]) -> tuple[list[int], list[float]]:
    order = list(range(len(pieces)))
    random.shuffle(order)
    rotations = [random.choice(pieces[i].allowed_rotations) for i in order]
    return order, rotations


def _fitness(order, rotations, pieces, sheet_width, spacing) -> float:
    sequence = [(pieces[idx], rot) for idx, rot in zip(order, rotations)]
    placements, unplaced = place_on_sheet(sequence, sheet_width, spacing)
    length = used_length(placements)
    # Heavily penalize unplaced pieces so a full-but-longer layout always
    # beats a short-but-incomplete one.
    penalty = len(unplaced) * sheet_width * 1000
    return length + penalty


def _ordered_crossover(parent_a: list[int], parent_b: list[int]) -> list[int]:
    n = len(parent_a)
    i, j = sorted(random.sample(range(n), 2))
    child = [None] * n
    child[i:j] = parent_a[i:j]
    fill = [g for g in parent_b if g not in child[i:j]]
    pos = 0
    for k in range(n):
        if child[k] is None:
            child[k] = fill[pos]
            pos += 1
    return child


def _mutate(order: list[int], rotations: list[float], pieces: list[Piece], rate: float):
    order = order.copy()
    rotations = rotations.copy()
    if random.random() < rate:
        i, j = random.sample(range(len(order)), 2)
        order[i], order[j] = order[j], order[i]
    for k in range(len(rotations)):
        if random.random() < rate:
            rotations[k] = random.choice(pieces[order[k]].allowed_rotations)
    return order, rotations


def optimize(
    pieces: list[Piece],
    sheet_width: float,
    spacing: float = 0.0,
    population_size: int = 16,
    generations: int = 25,
    mutation_rate: float = 0.15,
    seed: int | None = None,
) -> NestResult:
    clear_nfp_cache()

    if seed is not None:
        random.seed(seed)

    expanded = _expand_quantities(pieces)
    if not expanded:
        return NestResult([], [], 0.0, sheet_width, 0)

    # Heurística inicial: Ordenar piezas por área de cuadro delimitador descendente (First-Fit Decreasing Area)
    def piece_area(p: Piece) -> float:
        xs = [pt[0] for pt in p.contour]
        ys = [pt[1] for pt in p.contour]
        return (max(xs) - min(xs)) * (max(ys) - min(ys))

    indexed = list(enumerate(expanded))
    indexed.sort(key=lambda item: piece_area(item[1]), reverse=True)
    heuristic_order = [item[0] for item in indexed]
    heuristic_rotations = [0.0] * len(expanded)

    # Caché de fitness por individuo
    fitness_cache = {}

    def get_fitness(order, rotations):
        key = (tuple(order), tuple(rotations))
        if key not in fitness_cache:
            fitness_cache[key] = _fitness(order, rotations, expanded, sheet_width, spacing)
        return fitness_cache[key]

    population = [(heuristic_order, heuristic_rotations)]
    while len(population) < population_size:
        population.append(_random_individual(expanded))

    best_order, best_rot = population[0]
    best_score = float("inf")

    for gen in range(generations):
        scored = sorted(population, key=lambda ind: get_fitness(ind[0], ind[1]))
        gen_best_order, gen_best_rot = scored[0]
        gen_best_score = get_fitness(gen_best_order, gen_best_rot)
        if gen_best_score < best_score:
            best_score, best_order, best_rot = gen_best_score, gen_best_order, gen_best_rot

        survivors = scored[: max(2, population_size // 4)]
        next_population = survivors.copy()
        while len(next_population) < population_size:
            pa, pb = random.sample(survivors, 2)
            child_order = _ordered_crossover(pa[0], pb[0])
            child_rot = [
                random.choice(expanded[idx].allowed_rotations) for idx in child_order
            ]
            child_order, child_rot = _mutate(child_order, child_rot, expanded, mutation_rate)
            next_population.append((child_order, child_rot))
        population = next_population

    sequence = [(expanded[idx], rot) for idx, rot in zip(best_order, best_rot)]
    placements, unplaced = place_on_sheet(sequence, sheet_width, spacing)
    return NestResult(
        placements=placements,
        unplaced_piece_ids=unplaced,
        used_length_mm=used_length(placements),
        sheet_width_mm=sheet_width,
        generations_run=generations,
    )
