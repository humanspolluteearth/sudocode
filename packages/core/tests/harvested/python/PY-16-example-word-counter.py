# Count words with a dictionary
text = input("Sentence: ").lower()
counts = {}

for word in text.split():
    counts[word] = counts.get(word, 0) + 1

for word, n in sorted(counts.items()):
    print(f"{word:<6}{n:>3}")
