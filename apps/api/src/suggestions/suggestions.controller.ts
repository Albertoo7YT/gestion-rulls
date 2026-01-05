import { Controller, Get, Query } from "@nestjs/common";
import { SuggestionsService } from "./suggestions.service";
import { PurchaseSuggestionsQueryDto } from "./dto/purchase-suggestions-query.dto";

@Controller("suggestions")
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Get("purchases")
  purchaseSuggestions(@Query() query: PurchaseSuggestionsQueryDto) {
    return this.suggestions.purchaseSuggestions(query);
  }
}
