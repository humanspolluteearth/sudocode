class Bag:
    def __init__(self, n):
        self.items = list(range(n))
    def __len__(self):
        return len(self.items)

b = Bag(3)
print(len(b), bool(b), bool(Bag(0)))
if not Bag(0):
    print("empty is falsy")

class Card:
    def __init__(self, rank):
        self.rank = rank
    def __lt__(self, other):
        return self.rank < other.rank
    def __le__(self, other):
        return self.rank <= other.rank
    def __gt__(self, other):
        return self.rank > other.rank
    def __ge__(self, other):
        return self.rank >= other.rank
    def __repr__(self):
        return "Card(" + str(self.rank) + ")"

cards = [Card(5), Card(2), Card(9)]
print(Card(1) < Card(2), Card(2) <= Card(2), Card(3) > Card(4), Card(4) >= Card(4))
print(sorted(cards))
print(min(cards), max(cards))
cards.sort(reverse=True)
print(cards)

class V:
    def __init__(self, n):
        self.n = n
    def __eq__(self, other):
        if not isinstance(other, V):
            return NotImplemented
        return self.n == other.n

print(V(1) == V(1), V(1) == 5, V(1) != 5)
try:
    Card(1) < 3
except AttributeError as e:
    print("AttributeError:", e)
try:
    class P: pass
    P() < P()
except TypeError as e:
    print("TypeError:", e)
