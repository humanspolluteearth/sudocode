nums = [10, 20, 30, 40, 50]
del nums[1]
print(nums)
del nums[-1]
print(nums)
del nums[0]
print(nums)
try:
    del nums[5]
except IndexError as e:
    print("IndexError:", e)
grid = [[1, 2], [3, 4]]
del grid[0][1]
print(grid)
d = {"a": 1, "b": 2}
del d["a"]
print(d)
print(round(2.675, 2), round(3.14159, 3), round(1234.5678, -2), round(2.5), round(3.5), round(-2.5), round(7, 1), round(1.005, 2))
print(round(2.5, 0), round(0.5), round(1.5), round(12345, -2), type(round(2.5)).__name__, type(round(2.5, 1)).__name__)
print(format(3.14159, ".2f"), format(42, "5d") + "|", format(42, "<5d") + "|", format(42, "^7d") + "|", format("hi", ">6s") + "|")
print(format(1234567.891, ",.2f"), format(0.25, "%"), format(255, "x"), format(255, "08b"), format(1e6, "e"))
print("{:+d} {:+.1f} {: d} {:08.3f} {:x>5} {:*^9}".format(5, 2.5, 7, 3.14159, "ab", "mid"))
name, price, qty = "Pen", 1.5, 12
print(f"{name:<10}{price:>8.2f}{qty:>5d}")
print(f"{name:>10}|{price:^10.1f}|{qty:03d}|{-qty:+d}|{12345.6789:,.1f}")
print(f"{'left':<8}|{'right':>8}|{'centre':^8}|")
print(f"{1/3:.3}|{1e-7:.2e}|{255:#x}|{255:o}|{3:b}|{1234567:,}|{0.5:.0%}")
f = open("out.txt", "w")
f.writelines(["a\n", "b\n"])
f.writelines(line + "\n" for line in ["c", "d"])
f.close()
print(open("out.txt").read().split())
f = open("out.txt")
line = f.readline()
while line != "":
    print(line.strip(), end=",")
    line = f.readline()
print()
f.close()
