//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"syscall/js"
	"time"

	"github.com/dlclark/regexp2"
)

type request struct {
	Pattern string   `json:"pattern"`
	Flags   string   `json:"flags"`
	Values  []string `json:"values"`
}

type response struct {
	Results []bool `json:"results,omitempty"`
	Error   string `json:"error,omitempty"`
}

func evaluate(input request) response {
	options := regexp2.None
	for _, flag := range input.Flags {
		switch flag {
		case 'i':
			options |= regexp2.IgnoreCase
		case 'm':
			options |= regexp2.Multiline
		case 's':
			options |= regexp2.Singleline
		case 'g': // Existence checks start fresh for every test case.
		default:
			return response{Error: fmt.Sprintf("Unsupported Mihomo flag: %c", flag)}
		}
	}
	// Mihomo treats backtick-separated filter expressions as alternatives.
	var expressions []*regexp2.Regexp
	for _, pattern := range strings.Split(input.Pattern, "`") {
		expression, err := regexp2.Compile(pattern, options)
		if err != nil {
			return response{Error: err.Error()}
		}
		expression.MatchTimeout = 250 * time.Millisecond
		expressions = append(expressions, expression)
	}
	results := make([]bool, len(input.Values))
	for index, value := range input.Values {
		for _, expression := range expressions {
			matched, err := expression.MatchString(value)
			if err != nil {
				return response{Error: "Matching timed out. Simplify the expression or shorten the test text."}
			}
			if matched {
				results[index] = true
				break
			}
		}
	}
	return response{Results: results}
}

func main() {
	js.Global().Set("regexVisMatch", js.FuncOf(func(_ js.Value, args []js.Value) any {
		var input request
		var result response
		if err := json.Unmarshal([]byte(args[0].String()), &input); err != nil {
			result = response{Error: err.Error()}
		} else {
			result = evaluate(input)
		}
		encoded, _ := json.Marshal(result)
		return string(encoded)
	}))
	select {}
}
