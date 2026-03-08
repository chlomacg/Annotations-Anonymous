import requests

href = ""
line_number = 0

with open("pdf-list", 'r') as f:
    for line in f:
        line = line.strip()
        if line != "":
            if line_number % 2 == 0:
                href = line
            else:
                name = f"{line}.pdf"
                pdf = requests.get(f"https://www.aa.org/{href}")
                with open(name, 'wb') as wfd:
                    print(name)
                    for chunk in pdf.iter_content(chunk_size=128):
                        wfd.write(chunk)

            print(f"{line_number} '{line}'")
            line_number += 1
