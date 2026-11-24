import random

random.seed(3)
rolls = [random.randint(1, 6) for _ in range(600)]
print(min(rolls), max(rolls), sum(rolls))
counts = {}
for r in rolls:
    counts[r] = counts.get(r, 0) + 1
print(sorted(counts.items()))
x = random.random()
print(0 <= x < 1)
u = [random.uniform(5, 7) for _ in range(100)]
print(min(u) >= 5, max(u) <= 7, round(sum(u), 6))
mixed = list(range(52))
random.shuffle(mixed)
print(sorted(mixed) == list(range(52)), mixed[:8])
