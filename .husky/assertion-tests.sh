# Prints, one per line as "<file>\t<test name>", each test whose staged diff adds
# an assertion. commit-msg checks its message names every one; run it yourself
# (`bun run assertions:staged`) before writing the message.

assertion='expect[(]|(get|query|find)(All)?By'

git diff --cached -U0 -- '*.test.ts' | awk -v re="$assertion" '
	/^\+\+\+ / { file = substr($0, 7); next }
	/^@@/ { split($3, h, ","); line = substr(h[1], 2) + 0; next }
	/^\+/ { if ($0 ~ re) lines[file] = lines[file] "," line; line++ }
	END { for (f in lines) print f "\t" substr(lines[f], 2) }
' | while IFS='	' read -r file lines; do
	git show ":$file" | awk -v file="$file" -v lines="$lines" '
		BEGIN { n = split(lines, l, ","); for (i = 1; i <= n; i++) want[l[i]] = 1 }
		pending { name = $0; pending = 0 }
		/^[[:space:]]*(it|test)(\.[a-z]+)?(\([^()]*\))?\(/ { name = $0; if ($0 ~ /\($/) pending = 1 }
		NR in want && name != "" {
			label = name
			sub(/^[[:space:]]*((it|test)(\.[a-z]+)?(\([^()]*\))?\()?[[:space:]]*/, "", label)
			# The name is the first string literal: quoted with \047, " or `.
			q = substr(label, 1, 1)
			if (q == "\047" || q == "\"" || q == "`") {
				label = substr(label, 2)
				label = substr(label, 1, index(label, q) - 1)
			}
			print file "\t" label
		}
	' | sort -u
done
