# This program has a bug. Run it, then use the debugger.
temps = []
for i in range(4):
    temps.append(float(input()))

total = 0
for t in temps:
    total = total + t

average = total / len(temps)
print("Average: " + average)
