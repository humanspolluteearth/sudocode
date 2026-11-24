scores = {}
with open("scores.txt", "r") as f:
    for line in f:
        name, score = line.strip().split(",")
        scores[name] = int(score)
print(scores)
best = max(scores, key=lambda n: scores[n])
print(best)
with open("scores.txt", "a") as f:
    f.write("Dee,77\n")
f = open("scores.txt")
lines = f.readlines()
f.close()
print(len(lines), lines[-1])
f = open("empty.txt")
print(repr(f.readline()), repr(f.read()), f.readlines())
f.close()
