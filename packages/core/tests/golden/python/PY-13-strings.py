s = "Hello, World"
print(s[0], s[-1], s[3:8], s[:5], s[7:], s[::-1], s[::2], s[-5:-1])
print(len(s), s + "!", "ab" * 3, "x" in s)
name, price, qty = "Tea", 2.5, 12
print(f"{name} costs {price:.2f} x{qty}")
print(f"[{name:>6}] [{name:<6}] [{name:^7}] [{qty:04d}] [{price:8.3f}] [{qty:,}] [{1234567:,}]")
print(f"{3.14159:.0f} {0.5:.0%} {255:x} {255:08b} {2:+d} {1e6:g} {12:5}|{'ab':5}|")
print(f"{name!r} {2 + 3} {{literal}}")
print("a\tb", 'single', """triple
quoted""")
