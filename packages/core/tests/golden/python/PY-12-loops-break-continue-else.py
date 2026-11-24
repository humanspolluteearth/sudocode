i = 0
while i < 10:
    i += 1
    if i % 2 == 0:
        continue
    if i > 7:
        break
    print(i)
else:
    print("never")
for n in range(2, 10):
    for d in range(2, n):
        if n % d == 0:
            break
    else:
        print(n, "is prime")
for k in range(5, 0, -2):
    print(k)
for c in "hi":
    pass
print(c)
print(list(range(3)), list(range(2, 5)), list(range(10, 0, -3)), len(range(0)))
