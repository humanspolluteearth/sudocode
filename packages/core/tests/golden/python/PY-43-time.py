import time
from time import sleep

start = time.time()
print(type(start).__name__, start > 1700000000)
time.sleep(0.05)
sleep(0.05)
elapsed = time.time() - start
print(elapsed >= 0.1, elapsed < 5)
time.sleep(0)
sleep(1)
print(time.time() - start >= 1.1)
before = time.time()
total = 0
for i in range(1000):
    total += i
after = time.time()
print(total, after >= before)
try:
    time.sleep(-1)
except ValueError as e:
    print("ValueError:", e)
try:
    time.sleep("1")
except TypeError as e:
    print("TypeError:", e)
